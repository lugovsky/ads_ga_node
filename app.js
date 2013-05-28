
/**
 * Module dependencies.
 */

var soap = require('soap'),
    connect = require('connect'),
    http = require('http')
    libxmljs = require('libxmljs');

var wsdlUrl = "http://print4:40410/Gaapi/v3/impress/insecure?wsdl",
    serverPort = 8081;

function GASecurity(idResolver) {
    var self = this;
    if (typeof idResolver === "function") {
        self._idResolverFunction = idResolver;
    } else {
        self._idResolverFunction = function() {
            return idResolver;
        }
    }
}

GASecurity.prototype.toXML = function() {
    return '<UserID xmlns="ga-ns">' + this._idResolverFunction() + '</UserID>';
};


soap.createClient(wsdlUrl, function(err, client) {
    if (!err) {
        client.setSecurity(new GASecurity(1));
        var app = connect();
        app.use( connect.json() );
        var routes = require('route66');

        function serveSoapMethod(func, client) {
            routes.post('/' + func, function(req, res, next) {
                client[func](req.body, function(err, result, raw) {
                    if (!err) {
                        res.writeHead(200, {'content-type': 'application/json'});
                        res.end(JSON.stringify(result));
                    } else {
                        res.writeHead(500, {'content-type': 'application/json'});
                        var xmlDocument = libxmljs.parseXmlString(raw);
                        var error = {
                            description: {
                                faultcode: xmlDocument.get('//faultcode').text(),
                                faultstring: xmlDocument.get('//faultstring').text()
                            },
                            errorObject: err
                        };
                        res.end(JSON.stringify(error));
                    }
                });

            });
        }

        for (var func in client) {
            if (client.hasOwnProperty(func)) {
                if (typeof client[func] === 'function') {
                    serveSoapMethod(func, client);
                }
            }
        }

        app.use(routes);
        http.createServer( app ).listen(serverPort);
        console.log('Server started listening at port %d', serverPort);
    } else {
        console.log("Error. " + err );
        process.exit();
    }

});
