app
// Directives
.directive('trackedTextField', [function() {
        return {
            restrict: 'A',
            scope: {
                onTextChange : '&',
                update : '='
            },
            link: function(scope, element, attrs){

                // Handles text insertion (Only tested on chrome)
                scope.$watch('update', function (value) {

                    if(value){
                        scope.Obj = value;
                        //Injecting value and method to controller
                        scope.Obj.change = {};
                        scope.Obj.init = function(body){
                            element[0].value = body;
                        }

                        scope.Obj.update = function(){


                            //Do not update if client is the sender
                            if(scope.Obj.change.sender_id == scope.Obj.client_id){
                                return;
                            }

                            var diff = scope.Obj.change.diff;

                            //For readability
                            var newStart, newEnd;
                            var currentStart = element[0].selectionStart;
                            var currentEnd = element[0].selectionEnd;
                            var changeStart = scope.Obj.change.start;
                            var changeEnd = scope.Obj.change.end;
                            var d = scope.Obj.change.data;
                            var len = scope.Obj.change.data.length;

                            //If caret behind the update
                            if(currentStart < changeStart){
                                newStart = currentStart;
                                newEnd = currentEnd;
                            //In the middle of the update
                            }else if(changeStart < changeEnd){
                                newStart = currentStart - (changeEnd - changeStart);
                                newEnd = currentEnd - (changeEnd - changeStart);
                            //If after the update
                            }else if(currentStart => changeStart){
                                newStart = currentStart + len;
                                newEnd = currentEnd + len;
                            }

                            var b = element[0].value
                            b = b.slice(0, changeStart+diff) + d + b.slice(changeEnd+diff);
                            element[0].value = b;

                            //Insert new text and adjust carret
                            //element[0].value = scope.Obj.change.changedBody
                            element[0].setSelectionRange(newStart,newEnd);
                        }
                    }
                });

                element.bind('cut', function(event){

                    // Length of doc before mod
                    var length = element[0].value.length;
                    var start = element[0].selectionStart;
                    var end = element[0].selectionEnd;

                    scope.onTextChange()({
                        'start':start,
                        'end':end,
                        'data':'',
                        'length':length})
                });

                element.bind('paste', function(event){

                    // Length of doc before mod
                    var length = element[0].value.length;
                    var insert = event.clipboardData.getData('text/plain');
                    var start = element[0].selectionStart;
                    var end = element[0].selectionEnd;

                    scope.onTextChange()({
                        'start':start,
                        'end':end,
                        'data':insert,
                        'length':length});

                });

                // Handles delete and backspace
                element.bind('keydown', function(event){

                    // Length of doc before mod
                    var length = element[0].value.length;
                    var start = element[0].selectionStart;
                    var end = element[0].selectionEnd;

                    switch(event.key){
                        case 'Backspace':
                            if(start==end) start--;
                            if(start<0) return;
                            scope.onTextChange()({
                                'start':start,
                                'end':end,
                                'data':'',
                                'length':length});
                            break;
                        case 'Delete':
                            if(start==end) end++;
                            scope.onTextChange()({
                                'start':start,
                                'end':end,
                                'data':'',
                                'length':length});
                            break;
                    }

                })

                // Handles char adding
                element.bind('keypress', function(event){

                    // Length of doc before mod
                    var length = element[0].value.length;
                    // Enter registers as keypress
                    var data = event.key == 'Enter'? '\n' : event.key;
                    var start = element[0].selectionStart;
                    var end = element[0].selectionEnd;

                    scope.onTextChange()({
                        'start':start,
                        'end':end,
                        'data':data,
                        'length':length});
                })

//                element.bind('keyup', function(event){
//
//
//                })
            }
        }
}])