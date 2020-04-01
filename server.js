// Starter code based off Socket.io chat tutorial https://socket.io/get-started/chat/
let express = require("express");
let app = express();
let http = require("http").createServer(app);
let io = require("socket.io")(http);

// Default port is 8080, however can use non-default port via cmd argument
let port = 8080;

if (process.argv.length === 3) {
    port = process.argv[2];
}

// Server index.html as the base page
app.get("/", function(req, res) {
    res.sendFile(__dirname + "/index.html");
});

// Serve css/js files in this directory
app.use("/", express.static(__dirname + "/"));

// Map for room IDs to socket IDs
let roomIDs = new Map();
// Map for socket IDs to usernames
let users = new Map();
// Set for socket IDs waiting for a random opponent
let randomUsers = new Set();
// Map for room IDs to room objects
let rooms = new Map();

// When a socket connects
io.on("connection", function(socket) {
    // Create a new roomID
    let roomID = createRandomRoomID(socket.id);
    // Create a new username
    users.set(socket.id, generateRandomUsername());

    // Let player know their roomID
    socket.emit("roomID", roomID);

    // If the user sends their own custom username
    socket.on("username", function(username) {
        users.set(socket.id, username);
    });

    // If user requests a username (i.e. they didn't have a username cookie)
    socket.on("requestUsername", function() {
        socket.emit("username", users.get(socket.id));
    });

    // If player disconnects
    socket.on("disconnect", function() {
        // Check if they are in a game
        if (rooms.has(roomID)) {
            let room = rooms.get(roomID);
            let opponentID = room.player1 == socket.id ? room.player2 : room.player1;
            // Tell opponent they disconnected
            io.to(opponentID).emit("opponentDisconnected");
            // Delete the room
            rooms.delete(roomID);
        }
        // Check if they are waiting for a random opponent
        if (randomUsers.has(socket.id)) {
            randomUsers.delete(socket.id);
        }
        // Remove the roomID from the map
        roomIDs.delete(roomID);
        // Remove the user from the map
        users.delete(socket.id);
    });

    // If player joins by a roomID
    socket.on("joinByRoomID", function(id) {
        id = parseInt(id);
        // Check if room ID exists
        if (roomIDs.has(id)) {
            // Check if game is already in progress or your own id
            if (!rooms.has(id) && roomIDs.get(id) != socket.id) {
                // Remove myself if I was waiting for a random game
                if (randomUsers.has(socket.id)) {
                    randomUsers.delete(socket.id);
                }
                
                // Change my roomID
                roomIDs.delete(roomID);
                roomID = id;

                // Create a new room
                let roomObj = { "player1": roomIDs.get(roomID),
                                "player2": socket.id,
                                "username1": users.get(roomIDs.get(roomID)),
                                "username2": users.get(socket.id),
                                "turn": 0, 
                                "grid": getGrid() }
            
                // Add this room to the room list
                rooms.set(roomID, roomObj);

                // Let opponent know they start the game (tell them their opponent)
                io.to(roomObj.player1).emit("start", roomObj.username2);
                // Let myself know opponent starts (tell them their opponent)
                socket.emit("theyStart", roomObj.username1);
            }
            else {
                // Let player know game is already in progress
                socket.emit("gameInvalid");
            }
        }
        else {
            // Let player know game does not exist
            socket.emit("gameInvalid");
        }
    });

    // If player requests to join a random room
    socket.on("joinRandomRoom", function() {
        // If they requested, but they're already waiting, ignore them, they're just annoying
        if (randomUsers.size == 1 && randomUsers.values().next().value == socket.id) {
            return;
        }
        // If there exists other waiting users
        else if (randomUsers.size > 0) {
            // Get the first opponent from the random users
            let opponent = randomUsers.values().next().value;
            randomUsers.delete(opponent);

            // Change room ID (need to search map by value, however these are also unique)
            roomIDs.delete(roomID);
            for (let [k, v] of roomIDs) {
                if (v == opponent) { 
                    roomID = k;
                }
            }  

            // Create a new room
            let roomObj = { "player1": roomIDs.get(roomID),
                            "player2": socket.id,
                            "username1": users.get(roomIDs.get(roomID)),
                            "username2": users.get(socket.id),
                            "turn": 0, 
                            "grid": getGrid() }
            
            // Add this room to the room list
            rooms.set(roomID, roomObj);

            // Let opponent know they start the game (tell them their opponent)
            io.to(roomObj.player1).emit("start", roomObj.username2);
            // Let myself know opponent starts (tell them their opponent)
            socket.emit("theyStart", roomObj.username1);
        }
        // Otherwise, this is the first person looking for a game
        else {
            // Add this user to the waiting queue
            randomUsers.add(socket.id);
            // Tell the user they have to wait
            socket.emit("waitingForRoom");
        }
    });

    // When player returns to menu upon game ending
    socket.on("returnToMenu", function() {
        // Create a new room ID
        roomID = createRandomRoomID(socket.id);

        // Let them know the new ID
        socket.emit("roomID", roomID);
    });

    // When player places a token
    socket.on("placeToken", function(colNum) {
        // Get the room object
        let roomObj = rooms.get(roomID);

        // If turn is even, and socket is player 1 or turn is odd, and socket is player 2
        // then this is a valid move. Otherwise player messed with client side js
        let yourTurn = (roomObj.turn % 2 == 0 && socket.id === roomObj.player1) || (roomObj.turn % 2 == 1 && socket.id !== roomObj.player1);

        // Verify colNum is a whole number between o to 6 (inclusive)
        if (isNaN(colNum) || colNum < 0 || colNum > 6 || colNum % 1 != 0) {
            socket.emit("invalidMove", { "grid": roomObj.grid, "turn": yourTurn });
        }

        if (yourTurn) {
            // Check if token was place in a valid column
            let valid = false;
            let winObj = null;
            for (let i = 0; i < 6; i++) {
                // Try to place the token in the first available row in column
                if (roomObj.grid[i][colNum] === 0) {
                    valid = true;
                    // Depending on the socket id, either this was player 1 or player 2
                    let playerNum = socket.id === roomObj.player1 ? 1 : 2;
                    // Populate grid
                    roomObj.grid[i][colNum] = playerNum;
                    // Validate if victory
                    winObj = validateConnect4(roomObj.grid, playerNum);
                    // Increment turn number
                    roomObj.turn++;
                    break;
                }
            }

            // If a valid move was done
            if (valid) {
                // Update room object
                rooms.set(roomID, roomObj);

                // Show the opponent the turn
                let opponentID = roomObj.player1 == socket.id ? roomObj.player2 : roomObj.player1;
                io.to(opponentID).emit("opponentTurn", { "grid": roomObj.grid, "win": winObj });

                // If game is won, let player know and remove game
                if (winObj.state) {
                    socket.emit("youWin", winObj);

                    rooms.delete(roomID);
                    roomIDs.delete(roomID);
                }
                // If game is tied, let player know and remove game
                if (winObj.tie) {
                    socket.emit("youTie");

                    rooms.delete(roomID);
                    roomIDs.delete(roomID);
                }
            }
            // If invalid, then the player clicked on a token that should have been disabled
            else {
                socket.emit("invalidMove", { "grid": roomObj.grid, "turn": yourTurn });
            }
        }
        // Otherwise it wasn't this players turn, thus it is invalid
        else {
            socket.emit("invalidMove", { "grid": roomObj.grid, "turn": yourTurn });
        }
    });
});

// Host the server locally on provided port num
http.listen(port, function() {
    console.log("Listening on port " + port);
});

// Function to generate a random username
function generateRandomUsername() {
    // From each array, select one random word (i.e. creates 3 word username)
    // Code based on this https://jsfiddle.net/ygo5a48r/
    let words = [];
    words.push(["Small", "Big", "Medium", "Miniscule", "Tiny", "Huge", "Gigantic"]);
    words.push(["Smelly", "Round", "Funky", "Quiet", "Agile", "Sneaky", "Loud"]);
    words.push(["Sheep", "Hippo", "Jaguar", "Emu", "Giraffe", "Koala", "Racoon"]);

    let username = "";
    for (word of words) {
        username += word[Math.floor(Math.random() * word.length)];
    }

    return username;
}

// Function to generate a random 9 digit room ID
function createRandomRoomID(socketID) {
    let roomID = Math.floor(100000000 + Math.random() * 900000000);
    while(roomIDs.has(roomID)) {
        roomID = Math.floor(100000000 + Math.random() * 900000000);
    }
    roomIDs.set(roomID, socketID);

    return roomID;
}

// Function to create an empty 6 x 7 2D array
function getGrid() {
    let grid = new Array(6);
    for (let i = 0; i < 6; i++) {
        grid[i] = new Array(7);
        for (let j = 0; j < 7; j++) {
            grid[i][j] = 0;
        }
    }

    return grid;
}

// Function to validate a connect 4 game for a win condition for a specific player
function validateConnect4(grid, playerNum) {
    // Horizontal victory
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 4; j++) {
            if (grid[i][j] == playerNum &&
                grid[i][j + 1] == playerNum &&
                grid[i][j + 2] == playerNum && 
                grid[i][j + 3] == playerNum) {
                    return { "state": true, "tie": false, "start": [i, j], "direction": "horizontal" };
                }
        }
    }

    // Vertical victory
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 7; j++) {
            if (grid[i][j] == playerNum &&
                grid[i + 1][j] == playerNum &&
                grid[i + 2][j] == playerNum && 
                grid[i + 3][j] == playerNum) {
                    return { "state": true, "tie": false, "start": [i, j], "direction": "vertical" };
                }
        }
    }

    // Diagonal Up victory
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            if (grid[i][j] == playerNum &&
                grid[i + 1][j + 1] == playerNum &&
                grid[i + 2][j + 2] == playerNum && 
                grid[i + 3][j + 3] == playerNum) {
                    return { "state": true, "tie": false, "start": [i, j], "direction": "diagonalUp" };
                }
        }
    }

    // Diagonal Down victory
    for (let i = 5; i > 2; i--) {
        for (let j = 0; j < 4; j++) {
            if (grid[i][j] == playerNum &&
                grid[i - 1][j + 1] == playerNum &&
                grid[i - 2][j + 2] == playerNum && 
                grid[i - 3][j + 3] == playerNum) {
                    return { "state": true, "tie": false, "start": [i, j], "direction": "diagonalDown" };
                }
        }
    }

    // Tie game
    let tie = true;
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 7; j++) {
            if (grid[i][j] != 1 && grid[i][j] != 2) {
                tie = false;
                break;
            }
        }
    }

    return { "state": false, "tie": tie, "start": null, "direction": null };
}