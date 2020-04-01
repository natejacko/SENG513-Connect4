# SENG513-Connect4
Connect-4 game created from the SENG513 individual project


GETTING STARTED
---------------
1) To start, change directories into the folder containing all files (connect4.css, connect4.js, index.html, server.js, and package.json)
2) Install the latest versions of socket.io and Express via the included package.json using *npm install*
   Or install each by:
   - *npm install socket.io*
   - *npm install express*
3) Run the server using *node server.js [port=8080]* (supplying the optional port number)
4) Connect to the webapp via any browser with **localhost:<port>** or **csx.cs.ucalgary.ca:<port>** if running the server on the Linux lab machines
   
REQUIREMENTS
------------
Cookies:
- Cookies parsed and set from client side js
- Cookies are for the username, and theme name
- Cookies are persistent and have a one year expiry

Colour Themes:
- One of three colour themes available to change the menu and game board
- Normal (similar to the normal connect-4 game), dark, and pastel themes

Usernames:
- Users are given a random three word username when they first visit the webapp
- Username can be changed when on the menu
- Usernames do NOT have to be unique

Game Play:
- Players alternate turns
- Rules of Connect-4 follow (4 tokens in a row, either horizontal, vertical, or diagonal)
- Opponent's move is shown after it's executed
- Valid and invalid moves are shown the the user
- Game will be detected when a victory or tie occurs

CODE SUMMARY AND DEPENDENCIES
-----------------------------
server.js:
- Node.js server depending on socket.io and Express
- Main point of entry
- Does most of the game validation (checking for valid moves from clients)

index.html:
- Single (dynamically updated) HTML page
- Contains the menu and game board
- Uses external css and js

connect4.css
- Main styling sheet
- All style done through basic CSS
- Uses Google Font API for different fonts (linked in index.html)

connect4.js 
- Main client JavaScript
- Updates HTML dynamically using basic JavaScript and JQuery (linked in index.html)
- Uses socket.io API
- Parses and sets browser cookies
