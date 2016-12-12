// Proof of concept application made for research purposes.
// Tested only in chrome 55 on desktop
// requires a mongoDB server to run

    // set up ========================
    var express  = require('express');
    var app      = express();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);
    var bodyParser = require('body-parser');
    var cookieParser = require('cookie-parser');

    // DB
    var mongo = require('mongodb');
    var MongoClient = mongo.MongoClient;
    MongoClient.connect("mongodb://localhost:27017/", function(err, db) {
    if(!err) {
            app.locals.db = db;
            //Create collection (if not exist)
            db.createCollection('test', function(err, collection) {
                if(!err){
                    app.locals.collection = collection;
                }else{
                    console.log('Fatal error creating/retrieving collection:', err);
                    process.exit();
                }
            });
        }else{
            console.log('Fatal error connecting to db:', err);
            process.exit();
        }
    });

    // configure ========================
    app.use(express.static(__dirname + '/public'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

    // =============================================================================
    // Sockets ---------------------------------------------------------------------

    var clients = {'idx_clientId':[]};
    io.on('connection', function(socket){

        console.info('New client connected (id=' + socket.id + ').');

        //Save the client under the doc id so we can emit to all clients modifying that doc
        socket.on('ClientPickedDoc', function(doc_id){
            // Make sure a doc was actually picked
            if(doc_id){

                // Load textbody to memory if no client already connected
                if (!(doc_id in clients)){

                    var o_id = new mongo.ObjectID(doc_id);
                    app.locals.collection.findOne(o_id, function(err, item) {

                        if(!err && item){

                            // Push client to mem and send doc body
                            clients[doc_id] = {clients:[socket], doc:item};
                            clients['idx_clientId'][socket.id] = doc_id;
                            item.client_id = socket.id;
                            socket.emit('InitClientDocBody', item);
                            sendUpdatedClientList(doc_id);

                        }else{

                            // Notify client that the doc does not exists
                            socket.emit('InitClientDocBody', {body:'Document does not exist'});

                        }
                    });
                } else {

                    clients[doc_id]['clients'].push(socket);
                    clients['idx_clientId'][socket.id] = doc_id;

                    //Add socket id to doc so client may send it when making changes
                    var doc = clients[doc_id]['doc'];
                    doc.client_id = socket.id;

                    socket.emit('InitClientDocBody',  doc);
                    sendUpdatedClientList(doc_id)


                }
            } else {
                socket.emit('InitClientDocBody', {body:'No Doc choosen'});
            }
        })

        socket.on('ClientChangedBody' , function(change){

            // If server is reset clients will be empty until they reconnect
            // But they may still try to change a doc
            if(!clients[change.doc_id]){
                return;
            }

            var diff = clients[change.doc_id]['doc']['body'].length - change.length;
            change.diff = diff;
            modStart = change.start;
            modEnd = change.end;


            // Make the change in the server memory
            clients[change.doc_id]['doc']['body'] =
                clients[change.doc_id]['doc']['body'].slice(0, modStart) +
                change.data +
                clients[change.doc_id]['doc']['body'].slice(modEnd);

            // Store the changed body so the client may use it
            change.changedBody = clients[change.doc_id]['doc']['body'];

            // Get array of clients attached to doc id and emit change
            var client = clients[change.doc_id]['clients'];
            for(var i in client){
                client[i].emit('ServerBodyChange', change);
            }
        })

        socket.on('CommitDocNow', function(doc_id){

            commitDocBody(doc_id);
        })

        socket.on('disconnect', function() {

            var doc_id = clients['idx_clientId'][socket.id];

            //remove client from doc_id list
            if(doc_id){

                var client_index = clients[doc_id]['clients'].indexOf(socket);
                if(client_index > -1){
                    clients[doc_id]['clients'].splice(client_index, 1);
                }

                if(clients[doc_id]['clients'].length == 0){
                    //Save and remove doc from memory
                    commitDocBody(doc_id);
                    delete clients[doc_id];
                }else{
                    //Notify remaining clients
                    sendUpdatedClientList(doc_id)
                }
            }

            //Remove client form index
            delete clients['idx_clientId'][socket.id];

        });

    });

    // =============================================================================
    // Documents API -----(This could really be done just as well with sockets)-----

    app.post('/api/documents/post', function(req, res) {

        var doc = {
            title: req.body.title,
            author: req.cookies['Username'],
            body: ""
        }

        app.locals.collection.insert(doc, function(err, insertedDoc){
            if(!err){
                res.send(doc._id);
                io.emit('DocListUpdated');

            }else {
                res.status(500).send('Internal error inserting new doc.');
            }
        });
    });

    app.get('/api/documents/get', function(req, res) {
        app.locals.collection.find().toArray(function(err, items) {
            if(!err){
                res.send(items);
            }else{
                console.log(err);
                res.status(500).send('Internal error retrieving docs in db.');
            }
        });
    });

    app.post('/api/documents/put', function(req, res) {

        commitDocBody(req.body.doc_id);

    });

    app.post('/api/documents/delete', function(req, res) {

        var doc_id = req.body.doc_id;
        var o_id = new mongo.ObjectID(doc_id);
        app.locals.collection.remove({_id: o_id}, function(err, result){

            if(!err){
                io.emit('DocListUpdated');
                res.send('OK');
            }else{
                console.log(err)
                res.status(500).send('Internal error removing doc.');
            }
        })

    })

    // =============================================================================
    // Application routes-----------------------------------------------------------
    app.get('*', function(req, res) {
        var user = req.cookies['Username'];
        if(user === undefined){
            res.sendFile(__dirname + '/public/html/reg.html');
        }else{
            res.sendFile(__dirname + '/public/main.html'); // load the view file (ui-router handles page changes on front-end)
        }
    });

    app.post('/newuser', function(req, res){
        var user = req.body.username;
        res.cookie('Username',user, { maxAge: 1000*3600*24*90, httpOnly: true });
        res.redirect('/chat');
    });

    // =============================================================================
    // Miscelaneous functions ------------------------------------------------------
    function sendUpdatedClientList(doc_id){

        // Gather all client ids connected to the doc
        var c_list = []
        for (var client in clients[doc_id]['clients']){
            c_list.push(clients[doc_id]['clients'][client].id)
        }

        //Emit to connected clients
        for (var client in clients[doc_id]['clients']){
            clients[doc_id]['clients'][client].emit('ConnectedClientsChanged', c_list)
        }
    }

    function commitDocBody(doc_id){
        if(doc_id){
            var o_id = new mongo.ObjectID(doc_id);
            app.locals.collection.update({_id:o_id}, clients[doc_id]['doc']);
        }
    }
    //Commit all texts to db every 5 min
    setInterval(function(){
        for(var doc_id in clients){
            if(doc_id!='idx_clientId') commitDocBody(doc_id)
        }
    }, 1000*60*5);

    // listen (start app with node server.js) ======================================
    var port = 8080;
    http.listen(port);
    console.log("App listening on port " + port);

