/**
 * @author: Sel <s@finalclass.net>
 * @date: 19.12.11
 * @time: 18:35
 */

$.require = (function () {

  var Module = (function () {

    /**
     * @class
     * @constructor
     * @param {String} name
     */
    var Module = function (name) {
      this.name = name;
      this._dependencies = new Array();
      this.state = Module.STATE_INITIALIZED;
      this.content = null;

      /**
       * @type {FunctionCall} functionCall
       */
      this.functionCall = null;
      /**
       * @type {Cache} cache
       */
      this.cache = null;
      /**
       * @type {FunctionCalls} functionCalls
       */
      this.functionCalls = null;
    };

    Module.STATE_INITIALIZED = 'initialized';
    Module.STATE_LOADED = 'loaded';
    Module.STATE_LOADING = 'loading';
    Module.STATE_READY = 'ready';

    Module.prototype.load = function () {
      this.state = Module.STATE_LOADING;
      $.getScript(this.name, $.proxy(this._onLoadComplete, this));
    };

    Module.prototype._onLoadComplete = function () {
      this.state = Module.STATE_LOADED;
      var lastFunctionCall = this.functionCalls.getLastAdded();
      if (lastFunctionCall != this.functionCall) {
        this._dependencies = lastFunctionCall.modules;
      }
      if (this._dependencies.length == 0) {
        this.state = Module.STATE_READY;
        cache.notifyModuleLoaded(this);
        this.functionCalls.callReady();
      }
    };

    Module.prototype.invalidateDependencies = function () {
      var allLoaded = true;
      for (var i in this._dependencies) {
        if (!this._dependencies.hasOwnProperty(i)) {
          continue;
        }
        var subModule = this._dependencies[i];
        allLoaded = allLoaded && (subModule.state == Module.STATE_READY);
      }
      if (allLoaded) {
        this.state = Module.STATE_READY;
        this.cache.notifyModuleLoaded(this);
        this.functionCalls.callReady();
      }
    };

    Module.prototype.hasDependency = function (module) {
      for (var i in this._dependencies) {
        if (!this._dependencies.hasOwnProperty(i)) {
          continue;
        }
        if (this._dependencies[i] == module) {
          return true;
        }
      }
      return false;
    };

    return Module;

  })();


  var Cache = (function () {

    /**
     * @class
     * @constructor
     */
    var Cache = function () {
      this._data = new Object();
    };

    /**
     *
     * @param {String} name
     * @return {Module}
     */
    Cache.prototype.findByName = function (name) {
      return this._data[name];
    };

    /**
     *
     * @param {Module} module
     */
    Cache.prototype.add = function (module) {
      this._data[module.name] = module;
      module.cache = this;
    };

    Cache.prototype.notifyModuleLoaded = function (loadedModule) {
      for (var i in this._data) {
        if (!this._data.hasOwnProperty(i)) {
          continue;
        }
        var module = this._data[i];
        if (module.hasDependency(loadedModule)) {
          module.invalidateDependencies();
        }
      }
    };

    return Cache;

  })();


  /**
   * @class
   * @constructor
   *
   * @param {Array} modules
   * @param {Function} callback
   */
  var FunctionCall = (function () {

    var FunctionCall = function (modules, callback) {
      this.modules = modules;
      this.callback = callback;
      for (var i in this.modules) {
        if (!this.modules.hasOwnProperty(i)) {
          continue;
        }
        var module = this.modules[i];
        module.functionCall = this;
      }
    };

    FunctionCall.prototype.modulesReady = function () {
      for (var i in this.modules) {
        if (!this.modules.hasOwnProperty(i)) {
          continue;
        }
        var module = this.modules[i];
        if (module.state != Module.STATE_READY) {
          return false;
        }
      }
      return true;
    };

    FunctionCall.prototype.load = function () {
      for (var i in this.modules) {
        if (this.modules.hasOwnProperty(i)) {
          this.modules[i].load();
        }
      }
    };

    return FunctionCall;

  })();

  /**
   * @class
   * @constructor
   */
  var FunctionCalls = (function () {
    var FunctionCalls = function () {
      this._data = new Array();
      this._byScripts = new Object();
      this._lastAdded = null;
    };

    /**
     *
     * @param {FunctionCall} funcCall
     */
    FunctionCalls.prototype.add = function (funcCall) {
      this._data.push(funcCall);
      for (var i in funcCall.modules) {
        if (!funcCall.modules.hasOwnProperty(i)) {
          continue;
        }
        funcCall.modules[i].functionCalls = this;
      }
      this._lastAdded = funcCall;
      this.callReady();
    };

    FunctionCalls.prototype.getLastAdded = function () {
      return this._lastAdded;
    };

    FunctionCalls.prototype.callReady = function () {
      for (var i = this._data.length - 1; i >= 0; i--) {
        /**
         * @type {FunctionCall} funcCall
         */
        var funcCall = this._data[i];
        if (funcCall.modulesReady()) {
          funcCall.callback();
          this._data.splice(i, 1);
        }
      }
    };

    return FunctionCalls;
  })();

  var cache = new Cache();
  var funcCalls = new FunctionCalls();

  return function (scripts, callback) {
    if (!(scripts instanceof Array)) {
      scripts = [scripts];
    }
    var modules = new Array();
    for (var i in scripts) {
      if (!scripts.hasOwnProperty(i)) {
        continue;
      }
      var module = cache.findByName(scripts[i]);
      if (!module) {
        module = new Module(scripts[i]);
        modules.push(module);
        cache.add(module);
      }
    }
    var funcCall = new FunctionCall(modules, callback);
    funcCalls.add(funcCall);
    funcCall.load();
  };
})();