// Globals
let socket = null;
let playerNum = null;
let colCount = [0, 0, 0, 0, 0, 0, 0];
let waiting = false;
let opponent = null;

// Wait for doc to be ready to connect to socket and init
$(document).ready(function() {
    // Connect to the socket
    socket = io();

    /********************/
    /*****  COOKIES *****/
    /********************/
    
    // Parse theme and user cookies
    let theme = null;
    const themeCookie = "theme=";
    const userCookie = "username=";
    let userCookieFound = false;
    let cookies = decodeURIComponent(document.cookie).split(';');
    // Loop through cookies
    for(let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        while (cookie.charAt(0) === ' ') {
            cookie = cookie.substring(1);
        }
        // If theme cookie found, set it's value
        if (cookie.indexOf(themeCookie) === 0) {
            theme = cookie.substring(themeCookie.length, cookie.length);
        }
        // If user cookie found, mark it as found and tell the server your username
        if (cookie.indexOf(userCookie) === 0) {
            userCookieFound = true;
            $("#username").val(cookie.substring(userCookie.length, cookie.length));
            socket.emit("username", $("#username").val());
        }
    }

    // If user cookie wasn't found, request a username
    if (!userCookieFound) {
        socket.on("username", function(name) {
            document.cookie = "username=" + name + "; expires=" + getOneYear();
            $("#username").val(name);
        });

        socket.emit("requestUsername");
    }

    // If theme cookie wasn't found, get the default theme from the document and set this as the cookie
    if (theme === null) {
        theme = $(document.body).attr("class");
        document.cookie = "theme=" + theme + "; expires=" + getOneYear();
    }
    // Otherwise, overwrite the default theme with the cookie value
    else {
        let body = $(document.body);
        body.removeClass();
        body.addClass(theme);
    }

    // Select the appropriate radio button for the theme
    $("#" + theme + "Menu").prop("checked", true);
    $("#" + theme + "Game").prop("checked", true);

    // Add listeners for the radio buttons to switch the theme
    $("input[type=radio]").click(function() {
        let val = $(this).val();
        // When switched, also update the cookie
        document.cookie = "theme=" + val + "; expires=" + getOneYear();
        $("#" + val + "Menu").prop("checked", true);
        $("#" + val + "Game").prop("checked", true);
        
        let body = $(document.body);
        body.removeClass();
        body.addClass(val);
    });

    /*********************/
    /*** JOINING GAMES ***/
    /*********************/

    // Listen for your room ID from the server
    socket.on("roomID", function(id) {
        $("#roomID").val(id);
    });

    // Handle when server tells you you're waiting for a room
    socket.on("waitingForRoom", function() {
        $(".waitingText").removeClass("transparent");
        waiting = true;
        // Simple loading dots to indicate "progress"
        function checkFlag() {
            if (waiting) {
                if ($(".waitingText").text().endsWith(".....")) {
                    $(".waitingText").text("Waiting for opponent");
                }
                else {
                    $(".waitingText").text($(".waitingText").text() + ".");
                }
                window.setTimeout(checkFlag, 400);
            }
        }

        checkFlag();
    });

    // Handle when server tells you you've requested to join an invalid game
    socket.on("gameInvalid", function() {
        $(".invalidText").removeClass("transparent");
    });

    // Listen for when server tells you you're starting the game
    socket.on("start", function(opponentUsername) {
        // Set my opponent's name
        opponent = opponentUsername;
        waiting = false;

        // Hide the menu and show the game
        $("#menu").addClass("hidden");
        $("#game").removeClass("hidden");

        $(".gameState p").text($("#username").val() + ", you start!");
        $(".gameState p").addClass("p1");
        // Enable the grid to play
        enableGrid();
        
        // Since I start, I'm player 1 (used for themes)
        playerNum = 1;
    });

    // Listen for when server tells you you're opponent starts the game
    socket.on("theyStart", function(opponentUsername) {
        // Set my opponent's name
        opponent = opponentUsername;
        waiting = false;

        // Hide the menu and show the game
        $("#menu").addClass("hidden");
        $("#game").removeClass("hidden");

        // Initially disable the grid as it's not my turn
        disableGrid();

        $(".gameState p").text(opponent + " starts!");
        $(".gameState p").addClass("p2");

        // Since my opponent starts, I'm player 2 (used for themes)
        playerNum = 2;
    });

    /*********************/
    /*** PLAYING GAMES ***/
    /*********************/

    // Listen for when the server updates you with your opponent's turn
    socket.on("opponentTurn", function(obj) {
        // Update the grid
        populateGrid(obj.grid);

        // Check the win state of the game, if true, my opponent just won
        if (obj.win.state) {
            $(".gameState p").text(opponent + " won, you lost!");
            $(".gameState p").removeClass(playerNum === 1 ? "p1" : "p2");
            $(".gameState p").addClass(playerNum === 1 ? "p2" : "p1");

            // Show winning (game over) state
            gameOver(obj.win);

            // Enable the return to menu button
            $(".returnToMenuButton").removeClass("hidden");
        }
        // Check if the win state was a tie
        else if (obj.win.tie) {
            $(".gameState p").text("Tie game");
            $(".gameState p").removeClass("p1");
            $(".gameState p").removeClass("p2");
            $(".gameState p").addClass("tie");

            // Enable the return to menu button
            $(".returnToMenuButton").removeClass("hidden");
        }
        // Otherwise, I can play
        else {
            $(".gameState p").text($("#username").val() + ", it's your turn");
            $(".gameState p").removeClass(playerNum === 1 ? "p2" : "p1");
            $(".gameState p").addClass(playerNum === 1 ? "p1" : "p2");

            // Enable the grid to play
            enableGrid();
        }
    });

    // Listen for the server to tell you your move just won the game
    socket.on("youWin", function(obj) {
        $(".gameState p").text($("#username").val() + ", you won!");
        $(".gameState p").removeClass(playerNum === 1 ? "p2" : "p1");
        $(".gameState p").addClass(playerNum === 1 ? "p1" : "p2");

        // Show winning (game over) state
        gameOver(obj);

        // Enable the return to menu button
        $(".returnToMenuButton").removeClass("hidden");
    });

    // Listen for the server to tell you your move just tied the game
    socket.on("youTie", function() {
        $(".gameState p").text("Tie game");
        $(".gameState p").removeClass("p1");
        $(".gameState p").removeClass("p2");

        // Enable the return to menu button
        $(".returnToMenuButton").removeClass("hidden");
    });

    // Listen for the server to tell you your opponent disconnected (you win)
    socket.on("opponentDisconnected", function() {
        $(".gameState p").text(opponent + " disconnected, you won!");
        $(".gameState p").removeClass(playerNum === 1 ? "p2" : "p1");
        $(".gameState p").addClass(playerNum === 1 ? "p1" : "p2");

        // Enable the return to menu button
        $(".returnToMenuButton").removeClass("hidden");
    });

    // Listen for server to tell you your move was invalid
    // This is the preventative method that the server takes to tell you you broke the game
    // This will not be triggered unless you manually change client side js/css/html, so don't ;)
    socket.on("invalidMove", function(obj) {
        console.log("Bad move, don't mess with the client side code!");

        // Repopulate the grid with the servers grid
        populateGrid(obj.grid);

        // Enable grid on your turn, otherwise disable grid
        if (obj.turn) {
            enableGrid();
        }
        else {
            disableGrid();
        }
    });
});

// Function called when user changes their username, also updates the server with the new name
function changeUsername() {
    document.cookie = "username=" + $("#username").val() + "; expires=" + getOneYear();
    socket.emit("username", $("#username").val());
}

// Function to quickly copy the room ID to the clipboard
function copyID() {
    $("#roomID").select();
    document.execCommand("copy");
}

// Function to try to join a room by room ID
function joinRoom() {
    let roomID = $("#joinRoomID").val();
    socket.emit("joinByRoomID", roomID);
}

// Function to try to join a random room
function joinRandomRoom() {
    socket.emit("joinRandomRoom");
}

// Function to return to menu (main cleanup method)
function returnToMenu() {
    // Reset game board. Remove all tokens and highlights
    $(".cell").removeClass("token_p1");
    $(".cell").removeClass("token_p2");
    $(".cell").removeClass("cellHighlight");
    // Reset column count and player number
    colCount = [0, 0, 0, 0, 0, 0, 0];
    playerNum = null;
    
    //Reset back to the menu
    // Remove the (now invalid) room ID
    $("#joinRoomID").val("");

    // Hide the return to menu, invalid text, waiting text, and game board
    // Show the menu
    $(".returnToMenuButton").addClass("hidden");
    $(".invalidText").addClass("transparent");
    $(".waitingText").addClass("transparent");
    $("#menu").removeClass("hidden");
    $("#game").addClass("hidden");

    // Tell the server you've returned to menu (gives you a new room ID)
    socket.emit("returnToMenu");
}

// Function to called place a token on the board
function placeToken(colNum) {
    // Get the count of tokens in the current column
    let currentCol = colCount[colNum];

    // If valid (less than 6), then place this token
    if (currentCol < 6) {
        // Increment the number of tokens
        colCount[colNum]++;

        // Set the appropriate token colour
        let className = playerNum === 1 ? "token_p1" : "token_p2";

        // Place the token
        $(".cell[name=cell_" + currentCol + "-" + colNum + "]").addClass(className);
        $(".cell[name=cell_" + colNum).removeClass(className);  

        // Disabled the grid since your turn is now over
        disableGrid();

        $(".gameState p").text(opponent + "'s turn");
        $(".gameState p").removeClass(playerNum === 1 ? "p1" : "p2");
        $(".gameState p").addClass(playerNum === 1 ? "p2" : "p1");

        // Tell the server your intended move
        socket.emit("placeToken", colNum);
    }
    // Otherwise, you broke the js/css
    else {
        console.log("Error");
    }
}

// Function to enable the grid for play
function enableGrid() {
    // Get all cells
    let cells = $(".cell");

    // Add a click function
    cells.click(function() {
        // Get this cell's column and try to place a token in the column
        const colNum = $(this).attr("name").slice(name.length - 1);  
        placeToken(colNum);
    });

    // Add hover enter/leave function -> Adds an indicator on the top row for where your token will go
    cells.hover(function() {
        const colNum = $(this).attr("name").slice(name.length - 1);
        if (colCount[colNum] < 6) {
            let className = playerNum === 1 ? "token_p1" : "token_p2";
            $(".cell[name=cell_" + colNum).addClass(className);   
        }
    }, function() {
        const colNum = $(this).attr("name").slice(name.length - 1);
        let className = playerNum === 1 ? "token_p1" : "token_p2";
        $(".cell[name=cell_" + colNum).removeClass(className);   
    });

    // Remove any disabled cell and arrow state
    cells.removeClass("cellDisabled");
    $(".arrow").removeClass("arrowDisabled");

    // Disable columns which are currently full
    for (let i = 0; i < 7; i++) {
        if (colCount[i] === 6) {
            disableColumn(i);
        }
    }
}

// Function to disable the grid
function disableGrid() {
    // Get all cells
    let cells = $(".cell");

    // Remove their click and hover function
    cells.unbind("click");
    cells.unbind("mouseenter mouseleave");

    // Add a disabled state
    cells.addClass("cellDisabled");
    $(".arrow").addClass("arrowDisabled");
}

// Function to disable a single column
function disableColumn(colNum) {
    // Get all cells in the provided colNum
    let column = $(".cell").filter(function() {
        let re = new RegExp("cell_\\d\-" + colNum);
        return $(this).attr("name").match(re);
    });

    // Remove their click and hover function
    column.unbind("click");
    column.unbind("mouseenter mouseleave");

    // Add a disabled state
    column.addClass("cellDisabled");
    $(".cell[name=cell_" + colNum).addClass("columnDisabled");
}

// Function to populate the grid according to the array the server gave back
function populateGrid(grid) {
    // Remove all tokens
    $(".cell").removeClass("token_p1");
    $(".cell").removeClass("token_p2");

    // Reset the column counts
    colCount = [0, 0, 0, 0, 0, 0, 0];

    // Loop through the array
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 7; j++) {
            // Place the appropriate tokens of the appropriate style
            if (grid[i][j] === 1) {
                colCount[j]++;
                $(".cell[name=cell_" + i + "-" + j + "]").addClass("token_p1");
            }
            else if (grid[i][j] === 2) {
                colCount[j]++;
                $(".cell[name=cell_" + i + "-" + j + "]").addClass("token_p2");
            }
        }
    }
}

// Function to highlight the winning line
function gameOver(winObj) {
    // Get the starting row/column values
    let startRow = winObj.start[0];
    let startCol = winObj.start[1];

    // Get the direction of the victory
    const direction = winObj.direction;

    // Apply styling according to the start point and direction of victory
    switch(direction) {
        case "horizontal":
            $(".cell[name=cell_" + startRow + "-" + startCol + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + startRow + "-" + (startCol + 1) + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + startRow + "-" + (startCol + 2) + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + startRow + "-" + (startCol + 3) + "]").addClass("cellHighlight");
            break;
        case "vertical":
            $(".cell[name=cell_" + startRow + "-" + startCol + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow + 1) + "-" + startCol + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow + 2) + "-" + startCol + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow + 3) + "-" + startCol + "]").addClass("cellHighlight");
            break;
        case "diagonalUp":
            $(".cell[name=cell_" + startRow + "-" + startCol + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow + 1) + "-" + (startCol + 1) + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow + 2) + "-" + (startCol + 2) + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow + 3) + "-" + (startCol + 3) + "]").addClass("cellHighlight");
            break;
        case "diagonalDown":
            $(".cell[name=cell_" + startRow + "-" + startCol + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow - 1) + "-" + (startCol + 1) + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow - 2) + "-" + (startCol + 2) + "]").addClass("cellHighlight");
            $(".cell[name=cell_" + (startRow - 3) + "-" + (startCol + 3) + "]").addClass("cellHighlight");
            break;
      }
}

// Function used for getting an expiration date 1 year from now (used to have persistent cookies)
function getOneYear() {
    let date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toUTCString();
}