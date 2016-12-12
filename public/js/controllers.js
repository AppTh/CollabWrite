app
// Controllers (one for each page)
.controller('bodyCtrl', [

    '$scope',
    '$rootScope',
    '$location',

    function($scope, $rootScope, $location){

            $rootScope.$watch(
                function() {
                    return $location.path();
                },
                function(val){
                    $scope.page = val;
                }
            )
        }
])
.controller('chatCtrl', [

    '$rootScope',
    '$stateParams',
    '$location',
    '$interval',

    function($rootScope, $stateParams, $location, $interval){
        var vm = this;

        var doc_id =  $stateParams.id;
        var client_id;
        vm.connectedClients = [];

        var socket = io();

        function init(){
            socket.emit('ClientPickedDoc',doc_id);
        }

        socket.on('connect', function(msg){
            init();
        })

        // Container for directive functions and vars
        vm.updateDir = {};

        socket.on('InitClientDocBody', function(doc){

            client_id = doc.client_id;
            vm.title = doc.title;
            vm.author = doc.author;

            vm.updateDir.init(doc.body);

            //Commit document to disc every 5 min

            //vars in the vm changed manually so we need to update DOM manually
            $rootScope.$apply();
        })

        vm.textChange = function(change){
            //Directive does not care about which doc it's processing so id is set here
            change.doc_id = doc_id;
            change.sender_id = client_id;
            socket.emit('ClientChangedBody', change);
        }

        socket.on('ServerBodyChange', function(change){
            vm.updateDir.change = change;
            vm.updateDir.client_id = client_id;
            vm.updateDir.update();
        })

        //TODO: Associate client id with client name
        socket.on('ConnectedClientsChanged', function(clientList){
            vm.connectedClients = clientList;
            $rootScope.$apply();
        })

        var triggerKeyDown = function (element, keyCode) {
            var e = $.Event("keydown");
            e.which = keyCode;
            element.trigger(e);
        };

        var author = function(){
            //TODO: Implement automatic author for testing
        }
        vm.triggerAuthor = function(){$interval(author, 1000)}

        // We need to manually disconnect from the server when ui-router changes state
        $rootScope.$watch(
            function() {
                return $location.path();
            },
            function(val){
                if(val != '/chat'){
                        socket.disconnect();
                    }
            }
        )
    }
])
.controller('statCtrl', [

    '$http',
    '$state',

    function($http, $state){

        var vm = this;
        var socket = io();

        vm.newDoc = function(){
            if(!vm.newTitle){
                alert('No title provided');
                return;
            }
            $http.post('/api/documents/post', {title:vm.newTitle})
            .then(
                function(data){
                    vm.openDoc(data.data);
                },
                function(err){
                    console.log(err);
                }
            )
        }

        vm.getDocs = function(){
            $http.get('/api/documents/get')
            .then(
                function(data){
                    vm.documents = data.data;
                    for(var i in vm.documents){
                        //Get created timestamp from mongoDb _id
                        timestamp = vm.documents[i]._id.toString().substring(0,8);
                        vm.documents[i].created = new Date( parseInt( timestamp, 16 ) * 1000 );
                    }
                },
                function(err){
                    console.log(err);
                }
            )
        }

        vm.removeDoc = function(doc_id){
             console.log(doc_id);
             $http.post('/api/documents/delete', {
                doc_id:doc_id
             })
             .then(
                function(data){
                    vm.getDocs();
                },
                function(err){
                    console.log(err);
                }
            )
        }

        vm.openDoc = function(doc_id){
            $state.go("chat", {id:doc_id});
        }

        //Init controller with docs from db
        vm.getDocs()
        socket.on('DocListUpdated', function(){
            vm.getDocs();
        })
    }
])