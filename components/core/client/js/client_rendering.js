define([
    'raintime/lib/promise',
    'raintime/messaging/sockets',
    'raintime'
], function (Promise, Sockets, Raintime) {
    /**
     * The ClientRenderer handles the registration and inserting of new components from the server.
     * If a component takes too long to be obtained from the server, a placeholder is used to show
     * that the component is still loading.
     *
     * This works for all transport layers.
     *
     * @name ClientRenderer
     * @class A ClientRenderer instance
     * @constructor
     */
    function ClientRenderer() {
        var self = this;
        this.placeholderComponent = null;
        this.placeholderTimeout = 500;
        this.counter = 0;

        var socket = this.socket = Sockets.getSocket('/core');
        socket.on('render', function (component) {
            Raintime.componentRegistry.deregister(component.instanceId);
            self.renderComponent(component);
        });
    }

    /**
     * Sets the placeholder component.
     *
     * @param {Object} component the whole rendered placeholder component
     */
    ClientRenderer.prototype.setPlaceholder = function (component) {
        this.placeholderComponent = component;
    };

    /**
     * Sets the placeholder timeout which is set from the server configuration.
     *
     * @param {Number} milliseconds time in milliseconds
     */
    ClientRenderer.prototype.setPlaceholderTimeout = function (milliseconds) {
        this.placeholderTimeout = milliseconds;
    };

    /**
     * Requests a component over websockets.
     *
     * @param {Object} component the information about the requested component
     */
    ClientRenderer.prototype.requestComponent = function (component) {
        if (!component.id || !component.instanceId || !component.view) {
            console.error('Component id, instance id and view are required!');
            return;
        }
        if (component.placeholder && component.placeholder === true) {
            placeholderTimeout(this, component);
        }
        this.socket.emit('render', component, function (error) {});
    };

    /**
     * Renders the component to the DOM and registers it.
     *
     * @param {Object} component the rendered component
     */
    ClientRenderer.prototype.renderComponent = function (component) {
        var domElement = $('#' + component.instanceId);
        domElement.hide().html(component.html);
        domElement.attr('id', component.instanceId);
        domElement.attr('class',
            'app-container ' + component.id + '_' + component.version.replace(/[\.]/g, '_')
        );

        // Registers the component.
        Raintime.componentRegistry.register(component);

        if (!component.css || component.css.length == 0) {
            domElement.show();
        } else {
            loadCSS(this, component.css, function () {
                domElement.show();
            });
        }

        for (var len = component.children.length, i = 0; i < len; i++) {
            var childComponent = component.children[i];
            Raintime.componentRegistry.preRegister(childComponent);
            if (childComponent.placeholder === true) {
                placeholderTimeout(this, childComponent);
            }
        }
    };

    /**
     * Renders the placeholder.
     *
     * @param {String} instanceId the instanceId of the component for the placeholder
     */
    ClientRenderer.prototype.renderPlaceholder = function (instanceId) {
        this.placeholderComponent.instanceId = instanceId;
        this.renderComponent(this.placeholderComponent);
    };

    /**
     * Renders the placeholder if the component is not returned in time (placeholderTimeout).
     *
     * @param {ClientRenderer} self the class instance
     * @param {Object} placeholder the placeholder component
     * @private
     * @memberOf ClientRenderer#
     */
    function placeholderTimeout(self, placeholder) {
        setTimeout(function() {
            if (!$('#' + placeholder.instanceId).hasClass('app-container')) {
                self.renderPlaceholder(placeholder.instanceId);
            }
        }, self.placeholderTimeout);
    }

    /**
     * Load css files and insert html after the css files are completely loaded.
     * Maybe there is a better way. This works on IE8+, Chrome, FF, Safari.
     *
     * @param {ClientRenderer} self the class instance
     * @param {Array} css CSS dependencies
     * @param {Function} callback is invoked after all css dependencies are loaded
     * @private
     * @memberOf ClientRenderer#
     */
    function loadCSS(self, css, callback) {
        var head = $('head');
        var loadedFiles = 0;
        for (var i = 0, len = css.length; i < len; i++) {
            if (head.find("link[href='" + css[i] + "']").length > 0) {
                if (++loadedFiles == css.length) {
                    callback();
                }
            } else {
                var link = document.createElement('link');
                link.type = 'text/css';
                link.rel = 'stylesheet';
                link.href = css[i];

                var loader = new Image();
                loader.onerror = function(e) {
                    if (++loadedFiles == css.length) {
                        callback();
                    }
                };
                head.append(link);
                loader.src = css[i];
            }
        }
    }

    /**
     * Export as a global.
     *
     * @private
     */
    window.clientRenderer = new ClientRenderer();

    return window.clientRenderer;
});