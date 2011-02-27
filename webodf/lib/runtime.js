/*jslint nomen: false, evil: true, bitwise: false */
/*global window XMLHttpRequest require console process __dirname setTimeout
  Packages print readFile quit Buffer ArrayBuffer Uint8Array*/

/**
 * Three implementations of a runtime for browser, node.js and rhino.
 */

/**
 * Abstraction of the runtime environment.
 * @interface
 */
function Runtime() {}
/**
 * Abstraction of byte arrays.
 * @constructor
 * @param {!number} size
 */
Runtime.ByteArray = function (size) {};
/**
 * @type {!number}
 */
Runtime.ByteArray.prototype.length = 0;
/**
 * @param {!number} start
 * @param {!number} end
 * @return {!Runtime.ByteArray}
 */
Runtime.ByteArray.prototype.slice = function (start, end) {};
/**
 * @param {!Array.<number>} array
 * @return {!Runtime.ByteArray}
 */
Runtime.prototype.byteArrayFromArray = function (array) {};
/**
 * @param {!string} string
 * @param {!string} encoding
 * @return {!Runtime.ByteArray}
 */
Runtime.prototype.byteArrayFromString = function (string, encoding) {};
/**
 * @param {!Runtime.ByteArray} bytearray
 * @param {!string} encoding
 * @return {!string}
 */
Runtime.prototype.byteArrayToString = function (bytearray, encoding) {};
/**
 * @param {!Runtime.ByteArray} bytearray1
 * @param {!Runtime.ByteArray} bytearray2
 * @return {!Runtime.ByteArray}
 */
Runtime.prototype.concatByteArrays = function (bytearray1, bytearray2) {};
/**
 * @param {!string} path
 * @param {!number} offset
 * @param {!number} length
 * @param {!function(string,Runtime.ByteArray):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.read = function (path, offset, length, callback) {};
/**
 * @param {!string} path
 * @param {!string} encoding text encoding or 'binary'
 * @param {!function(string,string):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.readFile = function (path, encoding, callback) {};
/**
 * @param {!string} path
 * @param {!string} encoding text encoding or 'binary'
 * @return {!string}
 */
Runtime.prototype.readFileSync = function (path, encoding) {};
/**
 * @param {!string} path
 * @param {!function((string|Document)):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.loadXML = function (path, callback) {};
/**
 * @param {!string} path
 * @param {!Runtime.ByteArray} data
 * @param {!function(?string):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.writeFile = function (path, data, callback) {};
/**
 * @param {!string} path
 * @param {!function(boolean):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.isFile = function (path, callback) {};
/**
 * @param {!string} path
 * @param {!function(number):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.getFileSize = function (path, callback) {};
/**
 * @param {!string} path
 * @param {!function(?string):undefined} callback
 * @return {undefined}
 */
Runtime.prototype.deleteFile = function (path, callback) {};
/**
 * @param {!string} msgOrCategory
 * @param {!string=} msg
 * @return {undefined}
 */
Runtime.prototype.log = function (msgOrCategory, msg) {};
/**
 * @param {!function():undefined} callback
 * @param {!number} milliseconds
 * @return {undefined}
 */
Runtime.prototype.setTimeout = function (callback, milliseconds) {};
/**
 * @return {!Array.<string>}
 */
Runtime.prototype.libraryPaths = function () {};
/**
 * @return {string}
 */
Runtime.prototype.type = function () {};
/**
 * @return {?DOMImplementation}
 */
Runtime.prototype.getDOMImplementation = function () {};
/**
 * @return {?Window}
 */
Runtime.prototype.getWindow = function () {};

/** @define {boolean} */
var IS_COMPILED_CODE = false;

/**
 * @constructor
 * @implements {Runtime}
 * @param {Element} logoutput
 */
function BrowserRuntime(logoutput) {
    var self = this,
        cache = {},
        // nativeio is a binding point for io of native runtime
        nativeio = window.nativeio || {};

    // if Uint8Array is available, use that
    if (window.ArrayBuffer && window.Uint8Array) {
        /**
         * @constructor
         * @param {!number} size
         */
        this.ByteArray = function ByteArray(size) {
            return new Uint8Array(new ArrayBuffer(size));
        };
    } else {
        /**
         * @constructor
         * @param {!number} size
         */
        this.ByteArray = function ByteArray(size) {
            return new Array(size);
        };
    }

    function byteArrayToString(bytearray) {
        var s = "", i, l = bytearray.length;
        for (i = 0; i < l; i += 1) {
            s += String.fromCharCode(bytearray[i] & 0xff);
        }
        return s;
    }
    function utf8ByteArrayToString(bytearray) {
        var s = "", i, l = bytearray.length,
            c0, c1, c2;
        for (i = 0; i < l; i += 1) {
            c0 = bytearray[i];
            if (c0 < 0x80) {
                s += String.fromCharCode(c0);
            } else {
                i += 1;
                c1 = bytearray[i];
                if (c0 < 0xe0) {
                    s += String.fromCharCode(((c0 & 0x1f) << 6) | (c1 & 0x3f));
                } else {
                    i += 1;
                    c2 = bytearray[i];
                    s += String.fromCharCode(((c0 & 0x0f) << 12) |
                            ((c1 & 0x3f) << 6) | (c2 & 0x3f));
                }
            }
        }
        return s;
    }
    function utf8ByteArrayFromString(string) {
        var l = string.length,
            bytearray = new self.ByteArray(l),
            i, n, j = 0;
        for (i = 0; i < l; i += 1) {
            n = string.charCodeAt(i);
            if (n < 0x80) {
                bytearray[j] = n;
                j += 1;
            } else if (n < 0x800) {
                bytearray[j] = 0xc0 | (n >>>  6);
                bytearray[j + 1] = 0x80 | (n & 0x3f);
                j += 2;
            } else {
                bytearray[j] = 0xe0 | ((n >>> 12) & 0x0f);
                bytearray[j + 1] = 0x80 | ((n >>>  6) & 0x3f);
                bytearray[j + 2] = 0x80 |  (n         & 0x3f);
                j += 3;
            }
        }
        return bytearray;
    }
    function byteArrayFromString(string) {
        // ignore encoding for now
        var l = string.length,
            a = new self.ByteArray(l), i;
        for (i = 0; i < l; i += 1) {
            a[i] = string.charCodeAt(i) & 0xff;
        }
        return a;
    }
    this.byteArrayFromArray = function (array) {
        return array.slice();
    };
    this.byteArrayFromString = function (string, encoding) {
        if (encoding === "utf8") {
            return utf8ByteArrayFromString(string);
        } else if (encoding !== "binary") {
            self.log("unknown encoding: " + encoding);
        }
        return byteArrayFromString(string);
    };
    this.byteArrayToString = function (bytearray, encoding) {
        if (encoding === "utf8") {
            return utf8ByteArrayToString(bytearray);
        } else if (encoding !== "binary") {
            self.log("unknown encoding: " + encoding);
        }
        return byteArrayToString(bytearray);
    };
    this.concatByteArrays = function (bytearray1, bytearray2) {
        return bytearray1.concat(bytearray2);
    };

    function log(msgOrCategory, msg) {
        var node, doc, category;
        if (msg) {
            category = msgOrCategory;
        } else {
            msg = msgOrCategory;
        }
        if (logoutput) {
            doc = logoutput.ownerDocument;
            if (category) {
                node = doc.createElement("span");
                node.className = category;
                node.appendChild(doc.createTextNode(category));
                logoutput.appendChild(node);
                logoutput.appendChild(doc.createTextNode(" "));
            }
            node = doc.createElement("span");
            node.appendChild(doc.createTextNode(msg));
            logoutput.appendChild(node);
            logoutput.appendChild(doc.createElement("br"));
        } else if (console) {
            console.log(msg);
        }
    }
    function readFile(path, encoding, callback) {
        var xhr = new XMLHttpRequest();
        function handleResult() {
            var data;
            if (xhr.readyState === 4) {
                if (xhr.status === 0 && !xhr.responseText) {
                    // for local files there is no difference between missing
                    // and empty files, so empty files are considered as errors
                    callback("File is empty.");
                } else if (xhr.status === 200 || xhr.status === 0) {
                    // report file
                    if (encoding === "binary") {
                        data = self.byteArrayFromString(xhr.responseText);
                        cache[path] = data;
                    } else {
                        data = xhr.responseText;
                    }
                    callback(null, data);
                } else {
                    // report error
                    callback(xhr.responseText || xhr.statusText);
                }
            }
        }
        xhr.open('GET', path, true);
        xhr.onreadystatechange = handleResult;
        if (encoding !== "binary") {
            xhr.overrideMimeType("text/plain; charset=" + encoding);
        } else {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
        }
        try {
            xhr.send(null);
        } catch (e) {
            callback(e.message);
        }
    }
    function read(path, offset, length, callback) {
        if (path in cache) {
            callback(null, cache[path].slice(offset, offset + length));
            return;
        }
        var xhr = new XMLHttpRequest();
        function handleResult() {
            var data;
            if (xhr.readyState === 4) {
                if (xhr.status === 0 && !xhr.responseText) {
                    // for local files there is no difference between missing
                    // and empty files, so empty files are considered as errors
                    callback("File is empty.");
                } else if (xhr.status === 200 || xhr.status === 0) {
                    // report file
                    data = new self.byteArrayFromString(xhr.responseText,
                            "binary");
                    cache[path] = data;
                    callback(null, data.slice(offset, offset + length));
                } else {
                    // report error
                    callback(xhr.responseText || xhr.statusText);
                }
            }
        }
        xhr.open('GET', path, true);
        xhr.onreadystatechange = handleResult;
        xhr.overrideMimeType("text/plain; charset=x-user-defined");
        //xhr.setRequestHeader('Range', 'bytes=' + offset + '-' +
        //       (offset + length - 1));
        try {
            xhr.send(null);
        } catch (e) {
            callback(e.message);
        }
    }
    function readFileSync(path, encoding) {
        var xhr = new XMLHttpRequest(),
            result;
        xhr.open('GET', path, false);
        if (encoding !== "binary") {
            xhr.overrideMimeType("text/plain; charset=" + encoding);
        } else {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
        }
        try {
            xhr.send(null);
            if (xhr.status === 200 || xhr.status === 0) {
                result = xhr.responseText;
            }
        } catch (e) {
        }
        return result;
    }
    function writeFile(path, data, callback) {
        var xhr = new XMLHttpRequest();
        function handleResult() {
            if (xhr.readyState === 4) {
                if (xhr.status === 0 && !xhr.responseText) {
                    // for local files there is no difference between missing
                    // and empty files, so empty files are considered as errors
                    callback("File is empty.");
                } else if ((xhr.status >= 200 && xhr.status < 300) ||
                           xhr.status === 0) {
                    // report success
                    callback(null);
                } else {
                    // report error
                    callback("Status " + xhr.status + ": " +
                            xhr.responseText || xhr.statusText);
                }
            }
        }
        xhr.open('PUT', path, true);
        xhr.onreadystatechange = handleResult;
        data = self.byteArrayToString(data, "binary");
        try {
            if (xhr.sendAsBinary) {
                xhr.sendAsBinary(data);
            } else {
                xhr.send(data);
            }
        } catch (e) {
            self.log("HUH? " + e + " " + data);
            callback(e.message);
        }
    }
    function deleteFile(path, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('DELETE', path, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status < 200 && xhr.status >= 300) {
                    callback(xhr.responseText);
                } else {
                    callback(null);
                }
            }
        };
        xhr.send(null);
    }
    function loadXML(path, callback) {
        var xhr = new XMLHttpRequest();
        function handleResult() {
            if (xhr.readyState === 4) {
                if (xhr.status === 0 && !xhr.responseText) {
                    callback("File is empty.");
                } else if (xhr.status === 200 || xhr.status === 0) {
                    // report file
                    callback(xhr.responseXML);
                } else {
                    // report error
                    callback(xhr.responseText);
                }
            }
        }
        xhr.open("GET", path, true);
        xhr.overrideMimeType("text/xml");
        xhr.onreadystatechange = handleResult;
        try {
            xhr.send(null);
        } catch (e) {
            callback(e.message);
        }
    }
    function isFile(path, callback) {
        this.getFileSize(path, function (size) {
            callback(size !== -1);
        });
    }
    function getFileSize(path, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open("HEAD", path, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            var cl = xhr.getResponseHeader("Content-Length");
            if (cl) {
                callback(parseInt(cl, 10));
            } else { 
                callback(-1);
            }
        };
        xhr.send(null);
    }
    function wrap(nativeFunction, nargs) {
        if (!nativeFunction) {
            return null;
        }
        return function () {
            // clear cache
            cache = {};
            // assume the last argument is a callback function
            var callback = arguments[nargs],
                args = Array.prototype.slice.call(arguments, 0, nargs),
                callbackname = "callback" + String(Math.random()).substring(2);
            window[callbackname] = function () {
                delete window[callbackname];
                callback.apply(this, arguments);
            };
            args.push(callbackname);
            nativeFunction.apply(this, args);
        };
    }
    this.readFile = readFile;
    this.read = read;//wrap(nativeio.read, 3) || read;
    this.readFileSync = readFileSync;
    if (nativeio) {
        this.writeFile = (function () {
            var f = wrap(nativeio.writeFile, 2);
            return function (path, data, callback) {
                var d = this.byteArrayToString(data, "binary");
                f(path, d, callback);
            };
        }());
    } else {
        this.writeFile = writeFile;
    }
    this.deleteFile = wrap(nativeio.deleteFile, 1) || deleteFile;
    this.loadXML = loadXML;
    this.isFile = isFile;
    this.getFileSize = wrap(nativeio.getFileSize, 1) || getFileSize;
    this.log = log;
    this.setTimeout = function (f, msec) {
        setTimeout(f, msec);
    };
    this.libraryPaths = function () {
        return ["../lib", ".", "lib"]; // TODO: find a good solution
                                       // probably let html app specify it
    };
    this.setCurrentDirectory = function (dir) {
    };
    this.type = function () {
        return "BrowserRuntime";
    };
    this.getDOMImplementation = function () {
        return window.document.implementation;
    };
    this.exit = function (exitCode) {
        if (nativeio.exit) {
            nativeio.exit(exitCode);
        }
    };
    this.getWindow = function () {
        return window;
    };
}

/**
 * @constructor
 * @implements {Runtime}
 */
function NodeJSRuntime() {
    var self = this,
        fs = require('fs'),
        currentDirectory = "";

    /**
     * @constructor
     * @extends {Runtime.ByteArray}
     * @param {!number} size
     */
    this.ByteArray = function (size) {
        return new Buffer(size);
    };

    this.byteArrayFromArray = function (array) {
        var ba = new Buffer(array.length),
            i, l = array.length;
        for (i = 0; i < l; i += 1) {
            ba[i] = array[i];
        }
        return ba;
    };

    this.concatByteArrays = function (a, b) {
        var ba = new Buffer(a.length + b.length);
        a.copy(ba, 0, 0);
        b.copy(ba, a.length, 0);
        return ba;
    };

    this.byteArrayFromString = function (string, encoding) {
        return new Buffer(string, encoding);
    };

    this.byteArrayToString = function (bytearray, encoding) {
        return bytearray.toString(encoding);
    };

    function isFile(path, callback) {
        if (currentDirectory) {
            path = currentDirectory + "/" + path;
        }
        fs.stat(path, function (err, stats) {
            callback(!err && stats.isFile());
        });
    }
    function loadXML(path, callback) {
        throw "Not implemented.";
    }
    this.readFile = function (path, encoding, callback) {
        if (encoding !== "binary") {
            fs.readFile(path, encoding, callback);
        } else {
            fs.readFile(path, null, callback);
/*
            // we have to encode the returned buffer to a string
            // it would be nice if we would have a blob or buffer object
            fs.readFile(path, null, function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, data.toString("binary"));
            });
*/
        }
    };
    this.writeFile = function (path, data, callback) {
        console.log(data.length);
        fs.writeFile(path, data, "binary", function (err) {
            callback(err || null);
        });
    };
    this.deleteFile = fs.unlink;
    this.read = function (path, offset, length, callback) {
        if (currentDirectory) {
            path = currentDirectory + "/" + path;
        }
        fs.open(path, "r+", 666, function (err, fd) {
            if (err) {
                callback(err);
                return;
            }
            var buffer = new Buffer(length);
            fs.read(fd, buffer, 0, length, offset, function (err, bytesRead) {
                fs.close(fd);
                callback(err, buffer);
            });
        });
    };
    this.readFileSync = fs.readFileSync;
    this.loadXML = loadXML;
    this.isFile = isFile;
    this.getFileSize = function (path, callback) {
        if (currentDirectory) {
            path = currentDirectory + "/" + path;
        }
        fs.stat(path, function (err, stats) {
            if (err) {
                callback(-1);
            } else {
                callback(stats.size);
            }
        });
    };
    this.log = function (msg) {
        process.stderr.write(msg + '\n');
    };
    this.setTimeout = setTimeout;
    this.libraryPaths = function () {
        return [__dirname];
    };
    this.setCurrentDirectory = function (dir) {
        currentDirectory = dir;
    };
    this.currentDirectory = function () {
        return currentDirectory;
    };
    this.type = function () {
        return "NodeJSRuntime";
    };
    this.getDOMImplementation = function () {
        return;
    };
    this.exit = process.exit;
    this.getWindow = function () {
        return null;
    };
}

/**
 * @constructor
 * @implements {Runtime}
 */
function RhinoRuntime() {
    var dom = Packages.javax.xml.parsers.DocumentBuilderFactory.newInstance(),
        builder,
        entityresolver,
        currentDirectory = "";
    dom.setValidating(false);
    dom.setNamespaceAware(true);
    dom.setExpandEntityReferences(false);
    dom.setSchema(null);
    entityresolver = Packages.org.xml.sax.EntityResolver({
        resolveEntity: function (publicId, systemId) {
            var file, open = function (path) {
                var reader = new Packages.java.io.FileReader(path),
                    source = new Packages.org.xml.sax.InputSource(reader);
                return source;
            };
            file = systemId;
            //file = /[^\/]*$/.exec(systemId); // what should this do?
            return open(file);
        }
    });
    //dom.setEntityResolver(entityresolver);
    builder = dom.newDocumentBuilder();
    builder.setEntityResolver(entityresolver);

    /**
     * @constructor
     */
    this.ByteArray = function ByteArray() {
        return [];
    };
    this.byteArrayFromArray = function (array) {
        return array;
    };
    this.byteArrayFromString = function (string, encoding) {
        // ignore encoding for now
        var a = [], i, l = string.length;
        for (i = 0; i < l; i += 1) {
            a[i] = string.charCodeAt(i) & 0xff;
        }
        return a;
    };
    this.byteArrayToString = function (bytearray, encoding) {
        // ignore encoding for now
        return String.fromCharCode.apply(String, bytearray);
    };
    this.concatByteArrays = function (bytearray1, bytearray2) {
        return bytearray1.concat(bytearray2);
    };

    function loadXML(path, callback) {
        var file = new Packages.java.io.File(path),
            document;
        try {
            document = builder.parse(file);
        } catch (err) {
            print(err);
        }
        callback(document);
    }
    function runtimeReadFile(path, encoding, callback) {
        var file = new Packages.java.io.File(path),
            data;
        if (!file.isFile()) {
            callback(path + " is not a file.");
        } else {
            if (encoding === "binary") {
                encoding = "latin1"; // read binary, seems hacky but works
            }
            data = readFile(path, encoding);
            callback(null, data);
        }
    }
    /**
     * @param {!string} path
     * @param {!string} encoding
     * @return {?string}
     */
    function runtimeReadFileSync(path, encoding) {
        var file = new Packages.java.io.File(path), data, i;
        if (!file.isFile()) {
            return null;
        }
        if (encoding === "binary") {
            encoding = "latin1"; // read binary, seems hacky but works
        }
        return readFile(path, encoding);
    }
    function isFile(path, callback) {
        if (currentDirectory) {
            path = currentDirectory + "/" + path;
        }
        var file = new Packages.java.io.File(path);
        callback(file.isFile());
    }
    this.loadXML = loadXML;
    this.readFile = runtimeReadFile;
    this.writeFile = function (path, data, encoding, callback) {
        if (encoding !== "binary") {
            throw "Non-binary encoding not implemented.";
        }
        var out = new Packages.java.io.FileOutputStream(path),
            i,
            l = data.length;
        for (i = 0; i < l; i += 1) {
            out.write(data.charCodeAt(i));
        }
        out.close();
        callback(null);
    };
    this.deleteFile = function (path, callback) {
        var file = new Packages.java.io.File(path);
        if (file['delete']()) {
            callback(null);
        } else {
            callback("Could not delete " + path);
        }
    };
    this.read = function (path, offset, length, callback) {
        // TODO: adapt to read only a part instead of the whole file
        if (currentDirectory) {
            path = currentDirectory + "/" + path;
        }
        var data = runtimeReadFileSync(path, "binary");
        if (data) {
            callback(null, data.substring(offset, offset + length));
        } else {
            callback("Cannot read " + path);
        }
    };
    this.readFileSync = readFile;
    this.isFile = isFile; 
    this.getFileSize = function (path, callback) {
        if (currentDirectory) {
            path = currentDirectory + "/" + path;
        }
        var file = new Packages.java.io.File(path);
        callback(file.length());
    };
    this.log = print;
    this.setTimeout = function (f, msec) {
        f();
    };
    this.libraryPaths = function () {
        return ["lib"];
    };
    this.setCurrentDirectory = function (dir) {
        currentDirectory = dir;
    };
    this.currentDirectory = function () {
        return currentDirectory;
    };
    this.type = function () {
        return "RhinoRuntime";
    };
    this.getDOMImplementation = function () {
        return builder.getDOMImplementation();
    };
    this.exit = quit;
    this.getWindow = function () {
        return null;
    };
}

/**
 * @const
 * @type {Runtime}
 */
var runtime = (function () {
    if (typeof window !== "undefined") {
        return new BrowserRuntime(window.document.getElementById("logoutput"));
    } else {
        if (typeof require !== "undefined") {
            return new NodeJSRuntime();
        } else {
            return new RhinoRuntime();
        }
    }
}());

(function () {
    var cache = {};
    function definePackage(packageNameComponents) {
        var topname = packageNameComponents[0],
            i,
            pkg;
        // ensure top level package exists
        pkg = eval("if (typeof " + topname + " === 'undefined') {" +
                "eval('" + topname + " = {};');}" + topname);
        for (i = 1; i < packageNameComponents.length - 1; i += 1) {
            if (!(packageNameComponents[i] in pkg)) {
                pkg = pkg[packageNameComponents[i]] = {};
            }
        }
        return pkg;
    }
    /**
     * @param {string} classpath
     * @returns {undefined}
     */
    runtime.loadClass = function (classpath) {
        if (IS_COMPILED_CODE) {
            return;
        }
        if (classpath in cache) {
            return;
        }
        var names = classpath.split("."),
            impl;
        try {
            impl = eval(classpath);
            if (impl) {
                cache[classpath] = true;
                return;
            }
        } catch (e) {
        }
        function load(classpath) {
            var code, path, dirs, i;
            path = classpath.replace(".", "/") + ".js";
            dirs = runtime.libraryPaths();
            if (runtime.currentDirectory) {
                dirs.push(runtime.currentDirectory());
            }
            for (i = 0; i < dirs.length; i += 1) {
                try {
                    code = runtime.readFileSync(dirs[i] + "/" + path, "utf8");
                    if (code && code.length) {
                        break;
                    }
                } catch (ex) {
                }
            }
            if (code === undefined) {
                throw "Cannot load class " + classpath;
            }
            definePackage(names);
            try {
                code = eval(classpath + " = eval(code);");
            } catch (e) {
                runtime.log("Error loading " + classpath + " " + e);
                throw e;
            }
            return code;
        }
        // check if the class in context already
        impl = load(classpath);
        if (!impl || impl.name !== names[names.length - 1]) {
            runtime.log("Loaded code is not for " + names[names.length - 1]);
            throw "Loaded code is not for " + names[names.length - 1];
        }
        cache[classpath] = true;
    };
}());
(function (args) {
    args = Array.prototype.slice.call(args);
    function run(argv) {
        if (!argv.length) {
            return;
        }
        var script = argv[0];
        runtime.readFile(script, "utf8", function (err, code) {
            var path = "",
                paths = runtime.libraryPaths();
            if (script.indexOf("/") !== -1) {
                path = script.substring(0, script.indexOf("/"));
            }
            runtime.setCurrentDirectory(path);
            function run() {
                var script, path, paths, args, argv, result; // hide variables
                // execute script and make arguments available via argv
                result = eval(code);
                if (result) {
                    runtime.exit(result);
                }
                return;
            }
            if (err) {
                runtime.log(err);
                runtime.exit(1);
            } else {
                // run the script with arguments bound to arguments parameter
                run.apply(null, argv);
            }
        });
    }
    // if rhino or node.js, run the scripts provided as arguments
    if (runtime.type() === "NodeJSRuntime") {
        run(process.argv.slice(2));
    } else if (runtime.type() === "RhinoRuntime") {
        run(args);
    } else {
        run(args.slice(1));
    }
}(typeof arguments !== "undefined" && arguments));
