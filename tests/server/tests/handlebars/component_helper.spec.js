"use strict";

var cwd = process.cwd();
var globals = require(cwd + '/lib/globals.js');
var config = require(cwd + '/lib/configuration');
var loadFile = require(cwd + '/tests/server/rain_mocker');

describe('Handlebars component helper', function () {
    var componentHelper, Handlebars,
        mockComponentRegistry, componentRegistry,
        mockErrorHandler,
        mockDataLayer,
        mockRenderer,
        rainContext;

    beforeEach(function () {
        mockComponentRegistry = loadFile(cwd + '/lib/component_registry.js', null, true);
        var plugins = ['dynamic_conditions'];
        mockComponentRegistry.scanComponentFolder();
        mockComponentRegistry.registerPlugins(plugins);
        mockComponentRegistry.configurePlugins(plugins);
        componentRegistry = new mockComponentRegistry.ComponentRegistry();

        rainContext = {
            css: [],
            component: {
                id: 'example',
                version: '0.0.1'
            },
            childrenInstanceIds: [],
            instanceId: '12345',
            transport: {},
        };

        mockRenderer = {
            rain: rainContext,
            createInstanceId: function () {
                return 'new instance id';
            }
        };

        mockErrorHandler = loadFile(cwd + '/lib/error_handler.js', {
            './component_registry': componentRegistry
        });

        mockDataLayer = loadFile(cwd + '/lib/data_layer.js');
        mockDataLayer.loadData = function () {};

        componentHelper = loadFile(cwd + '/lib/handlebars/component.js', {
            '../data_layer': mockDataLayer,
            '../error_handler': mockErrorHandler,
            '../component_registry': componentRegistry,
            '../renderer': mockRenderer
        });

        Handlebars = require('handlebars');

        Handlebars.registerHelper(componentHelper.name, componentHelper.helper);
    });

    describe('register plugin to handlebars', function () {

        it('must register the component helper to Handlebars', function () {
            expect(componentHelper.name).toEqual('component');
            expect(typeof componentHelper.helper).toEqual('function');
        });

    });

    /**
     * Expect that the child component is actually the error component.
     *
     * @param {Object} childComponent the component
     * @param {Number} statusCode the error status code
     */
    function expectError(childComponent, statusCode) {
        expect(childComponent.id).toEqual('error');
        expect(childComponent.version).toEqual('1.0');
        expect(childComponent.controller).toEqual(statusCode + '.js');
    }

    /**
     * Expect the child component to match the specified component.
     *
     * @param {Object} childComponent the component
     * @param {Object} component the component object
     */
    function expectComponent(childComponent, component) {
        expect(childComponent.id).toEqual(component.id);
        expect(childComponent.version).toEqual(component.version);
        expect(childComponent.controller).toEqual(component.controller);
    }

    describe('test required and optional options', function () {

        it('must require "view" to be defined', function () {
            Handlebars.compile('{{component name="button"}}')();
            expect(rainContext.childrenInstanceIds.length).toEqual(1);
            expectError(rainContext.childrenInstanceIds[0], 500);
        });

        it('must require "name" to be defined when "version" is present', function () {
            Handlebars.compile('{{component version="1.1" view="index"}}')();
            expectError(rainContext.childrenInstanceIds[0], 500);
        });

        it('must add all the necessary JSON dependencies', function () {
            Handlebars.compile('{{component name="button" version="1.0" view="index"}}')();
            var childComponent = rainContext.childrenInstanceIds[0];
            expect(childComponent.instanceId).toBeDefined();
            expectComponent(childComponent, {
                id: 'button',
                version: '1.0',
                controller: 'index.js'
            });
        });

    });

    describe('test default options and error cases', function () {

        it('must use the current component when "name" is not defined', function () {
            Handlebars.compile('{{component view="index"}}')();
            var childComponent = rainContext.childrenInstanceIds[0];
            expectComponent(childComponent, {
                id: 'example',
                version: '0.0.1',
                controller: 'index.js'
            });
        });

        it('must use the "error" component when the component is not found', function () {
            Handlebars.compile('{{component name="invalid_name" view="index"}}')();
            expectError(rainContext.childrenInstanceIds[0], 404);
        });

        it('must use the "error" component when the view is not found', function () {
            Handlebars.compile('{{component name="button" view="invalid_index"}}')();
            expectError(rainContext.childrenInstanceIds[0], 404);
        });

    });

    /**
     * Sets information about the user in the session.
     *
     * @param {Object} [user] use this user information instead of some default one
     */
    function setUserInSession(user) {
        rainContext.session = {
            user: user || {
                permissions: [
                    'view_button', 'view_restricted'
                ],
                country: 'US',
                language: 'en_US'
            }
        };
    }

    describe('test authorization cases', function () {

        it('must use the required component when the permission cases pass', function () {
            setUserInSession();
            Handlebars.compile('{{component name="button" version="1.0" view="restricted"}}')();
            var childComponent = rainContext.childrenInstanceIds[0];
            expectComponent(childComponent, {
                id: 'button',
                version: '1.0',
                controller: 'index.js'
            });
        });

        it('must use the "error" component when permission cases fail', function () {
            Handlebars.compile('{{component name="button" version="1.0" view="restricted"}}')();
            expectError(rainContext.childrenInstanceIds[0], 401);
        });

        it('must pass component level checks for dynamic conditions', function () {
            setUserInSession();
            Handlebars.compile('{{component name="button" version="2.0" view="buttons"}}')();
            var childComponent = rainContext.childrenInstanceIds[0];
            expectComponent(childComponent, {
                id: 'button',
                version: '2.0',
                controller: 'index.js'
            });
        });

        it('must use the "error" component when component level dynamic conditions fail', function () {
            setUserInSession({
                country: 'RO'
            });
            Handlebars.compile('{{component name="button" version="2.0" view="buttons"}}')();
            expectError(rainContext.childrenInstanceIds[0], 401);
        });

        it('must pass view level checks for dynamic conditions', function () {
            setUserInSession();
            Handlebars.compile('{{component name="button" version="2.0" view="index"}}')();
            var childComponent = rainContext.childrenInstanceIds[0];
            expectComponent(childComponent, {
                id: 'button',
                version: '2.0',
                controller: 'index.js'
            });
        });

        it('must use the "error" component when view level dynamic conditions fail', function () {
            setUserInSession({
                country: 'US',
                language: 'ro_RO'
            });
            Handlebars.compile('{{component name="button" version="2.0" view="index"}}')();
            expectError(rainContext.childrenInstanceIds[0], 401);
        });

    });
});
