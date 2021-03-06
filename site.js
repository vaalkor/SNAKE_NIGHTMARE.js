'use strict';
////=====CANVAS DATA=====/////
var canvas;
var ctx;
var currentBlockSize;
var w = window;
var requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;
////=====ANIMATION DATA==/////
var lastFrameMs = 0;
var deltaTime = 0;
////=====KEY DATA========////////
var keysPressed = Array(256).fill(false);
////=====SNAKE DATA======//////
var testingModeEnabled = false;
var CellTypes =
{
    None: 0, Tail: 1, Wall: 2, Bomb: 3, NoTailZone: 4, FastZone: 5
}
var Direction = 
{
    Up: 0, Right: 1, Down: 2, Left: 3
}
var gameModes =
{
    version: 1,
    brModeEnabled: false,
    sprintModeEnabled: true,
    holeySprintMode: true,
    wrapEnabled: true,
    bombModeEnabled: true,
    noTailZonesEnabled: false,
    fastZonesEnabled: false
};
var params = //Everything in here will be modifiable in the params modal box when I actually make it.
{
    version: 1,
    backgroundColor: "#ffd1dc",
    backgroundColor2: '#ffd1dc', //not sure about these colours now... Probs should allow the user to choose and store in localstorage...
    // backgroundColor2: '#d4abb5',
    gridColor: "#333333",
    wallEncroachmentInc: 1,
    wallEncroachmentTime: 600,
    bombRadius: 5,
    sprintLength: 1000,
    sprintRechargeTime: 7500, //10 seconds (ms)
    bombRechargeTime: 3000,
    cupWinLimit: 10,
    gridSize: 50,
    tempGridSize: 50, //this is stored so the params modal can modify this if it is called during a game for some weird reason. when the game starts gridsize will be set to tempgridsize.
    maxFps: 18
};

//game state variables. global variables galore!
var battleRoyalTimer = null; //timer for updating battle royale state at arbitrary intervals.
var wallEncroachment = 0;
var gameInProgress = false;
var waitingForReady = false;
var currConfigCntrls = false;
var currPlyrConfig = null;
var currButtonConfig = 0;
var playOnPlayersReady = true;
var printWinMessage = false;
var winnerId = -1;
var configButtons = null;
var tailArray = null;

var players = [];
players[0] = createPlayer(0, { x: 0.25, y: 0.25 }, "#3cb44b", { "up": 87, "down": 83, "left": 65, "right": 68, "sprint": 20, "bomb": 16 });
players[1] = createPlayer(1, { x: 0.75, y: 0.75 }, "#e6194b", { "up": 38, "down": 40, "left": 37, "right": 39, "sprint": 46, "bomb": 35 });
players[2] = createPlayer(2, { x: 0.75, y: 0.25 }, "#ffe119", { "up": 89, "down": 72, "left": 71, "right": 74, "sprint": 67, "bomb": 86 });
players[3] = createPlayer(3, { x: 0.25, y: 0.75 }, "#0082c8", { "up": 80, "down": 59, "left": 76, "right": 222, "sprint": 188, "bomb": 190 });

function createPlayer(id, startPos, color, keyMapping) 
{
    var player = {};
    player.version = 1;
    player.id = id;
    player.enabled = false;
    player.alive = false;
    player.ready = false;
	player.startPos = newPos(startPos); //used for resetting after a game has ended lad....
    player.pos = propPosToGrid(startPos);
    player.tempPos = propPosToGrid(startPos);
    player.color = color;
    player.direction = Direction.Up;
    player.startDirection = Direction.Up;
    player.keyMapping = keyMapping;
    player.name = "";
    player.wins = 0;
    player.bombCharge = 0;
    player.sprintCharge = 0;
    return player;
}

function declareTailArray()
{
    params.gridSize = params.tempGridSize;
    if(tailArray != undefined && tailArray.Length == params.gridSize) return;

    currentBlockSize = canvas.height / params.gridSize;

    tailArray = new Array(params.gridSize);
    for (let i = 0; i < params.gridSize; i++)
        tailArray[i] = new Array(params.gridSize);
    for (let i = 0; i < params.gridSize; i++)
        for (let j = 0; j < params.gridSize; j++)
            tailArray[i][j] = { type: CellTypes.None, id: -1 };
}

function checkMode(param) 
{
    gameModes[param] = !gameModes[param];
    updateStorage();
}

function handleKeyDown(e) 
{
    //ignore directional buttons and stuff so the page doesn't move when they are pressed.
    var keyCode = e.keyCode;
    if (keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40 || keyCode === 32)
    e.preventDefault();

    if (currConfigCntrls) 
    {        
        configButtons.each(function (b) { $(this).css("display", "none"); })
        var button = configButtons[currButtonConfig];
        currPlyrConfig.keyMapping[$(button).data()["button"]] = e.keyCode;
        currButtonConfig++;
        button = configButtons[currButtonConfig];
        $(button).css("display", "flex");
        
        if(currButtonConfig === configButtons.length)
        {
            configButtons.each(function (b) { $(this).css("display", "none"); })
            currConfigCntrls = false;
            currButtonConfig = 0;
            $("#startGameButton").css("display", "flex");
            updateStorage();
        }
    }
    else 
    {
        keysPressed[keyCode] = true;

        //Change directions of any player if needed.
        players.forEach(function (p) 
        { //this if statement is formatted REALLY badly but I'll fix that later...
            var dir = tryGetKeyPressDirection(keyCode, p);
            if (p.enabled &&  dir != null) 
            {
                checkPlayerReadyAfterKeyPress(p);
                tryChangeDirection(p, dir);
            }
        });
    }
}
function handleKeyUp(e)
{
    keysPressed[e.keyCode] = false;
}

function moveInDirectionFromPos(pos, direction)
{
    var newPosition = newPos(pos);
    if(direction === Direction.Up) newPosition.y -=1;
    else if(direction === Direction.Right) newPosition.x += 1;
    else if(direction === Direction.Down) newPosition.y +=1;
    else if(direction === Direction.Left) newPosition.x -=1;
    clampPos(newPosition);
    return newPosition;
}

//Tries to change direction. Will not change if it would cause the snake to go back on itself.
function tryChangeDirection(player, direction)
{
    var potentialNewPos = moveInDirectionFromPos(player.pos, direction);
    if(!posEqual(potentialNewPos, player.tempPos)) player.direction = direction;
}

//Checks if the player is pressing a directional key, and if they are, returns the direction.
function tryGetKeyPressDirection(keyCode, player)
{
    if(keyCode === player.keyMapping["up"]) return Direction.Up;
    else if(keyCode === player.keyMapping["right"]) return Direction.Right;
    else if(keyCode === player.keyMapping["down"]) return Direction.Down;
    else if(keyCode === player.keyMapping["left"]) return Direction.Left;
    return null;
}

function checkPlayerReadyAfterKeyPress(p)
{
    if(!waitingForReady || p.ready) return;
    p.ready = true;

    if (players.filter(x=>x.ready).length === players.filter(x=>x.enabled).length)
    {
        waitingForReady = false;
        setTimeout(requestAnimationFrame(mainLoop), 0);
    }
}

//functions for dealing with position objects...
function posEqual(pos1, pos2) 
{
    return pos1.x === pos2.x && pos1.y === pos2.y;
}

function newPos(pos) 
{
    return { x: pos.x, y: pos.y };
}

function clampPos(pos)
{
    pos.x = clampNum(pos.x);
    pos.y = clampNum(pos.y);
}

function propPosToGrid(p)
{
	var pos = newPos(p);
	pos.x = Math.floor(p.x*params.gridSize);
	pos.y = Math.floor(p.y*params.gridSize);
	return pos;
}

function movePlayerInDirection(player, leaveTail)
{
    player.tempPos = newPos(player.pos); //Save previous position for checking whether we will go backwards on ourselves in KeyDown handler.

    if((getCellTypeFromPos(player.pos) != CellTypes.NoTailZone) && leaveTail)
    {
        tailArray[player.pos.x][player.pos.y].type = CellTypes.Tail;
        tailArray[player.pos.x][player.pos.y].id = player.id;
    }

    if(player.direction === Direction.Up) player.pos.y -=1;
    else if(player.direction === Direction.Right) player.pos.x +=1;
    else if(player.direction === Direction.Down) player.pos.y +=1;
    else if(player.direction === Direction.Left) player.pos.x -=1;
    clampPos(player.pos);
}

////=====MAIN GAME LOGIC FUNCTIONS======//////
function iteratePlayerState() {
    for (let i = 0; i < params.gridSize; i++)
        for (let j = 0; j < params.gridSize; j++)
            if (tailArray[i][j].type === CellTypes.Bomb)
                tailArray[i][j].type = CellTypes.None;

    players.forEach(function (p, i) {
        if(testingModeEnabled){if(i!==0)return;} //In testing mode just move player 0.
        if (p.enabled && p.alive) {
            //increment bomb and sprint counters
            if (gameModes.bombModeEnabled && p.bombCharge < params.bombRechargeTime)
                p.bombCharge += 1000 / params.maxFps;

            if (gameModes.sprintModeEnabled && p.sprintCharge < params.sprintRechargeTime)
                p.sprintCharge += 1000 / params.maxFps;
            
            //HANDLE BOMB ENABLED MODE
            if (gameModes.bombModeEnabled && keysPressed[p.keyMapping["bomb"]] && p.bombCharge >= params.bombRechargeTime) 
            {
                p.bombCharge = 0;
                triggerBomb(p.pos.x, p.pos.y);
            }
            if(getCellTypeFromPos(p.pos) === CellTypes.FastZone){
                movePlayerInDirection(p, !gameModes.holeySprintMode); //Do an extra movement for being in a fast zone. Happens before normal movement. Leaving tail depends on holeySprintMode.
            }
            movePlayerInDirection(p, true); //The standard MOVE. leaves a tail block.

            //HANDLE SPRINT ENABLED MODE
            if (gameModes.sprintModeEnabled && keysPressed[p.keyMapping["sprint"]] && p.sprintCharge > 0.1 * params.sprintRechargeTime) 
            {
                if(getCellTypeFromPos(p.pos) === CellTypes.FastZone){
                    movePlayerInDirection(p, !gameModes.holeySprintMode); //Do an extra movement for being in a fast zone. Happens before normal movement. Leaving tail depends on holeySprintMode.
                }
                movePlayerInDirection(p, !gameModes.holeySprintMode); //The standard MOVE. leaves a tail block.

                p.sprintCharge -= deltaTime * params.sprintRechargeTime / params.sprintLength;
            }
            
            //HANDLE WRAP ENABLED MODE
            if (gameModes.wrapEnabled) 
            {   
                clampPos(p.pos);
            }
        }
    });
}

function getCellTypeFromPos(pos){
    return tailArray[pos.x][pos.y].type;
}

function clampNum(num){
    if(num < 0) return num + params.gridSize;
    else if(num >= params.gridSize) return num - params.gridSize;
    else return num;
}

function checkCollisions() {
    players.forEach(function (p) 
    {
        if (!p.enabled || !p.alive) return;
        
        p.alive = IsPlayerAlive(p);

        players.forEach(function (p2) 
        {
            if (p2.enabled && p.alive && p2.id != p.id && posEqual(p2.pos, p.pos)) 
            {
                p.alive = false;
                p2.alive = false;
            }
        });
    });
}

//This checks for collisions with other snake tails, pubg mode walls and the edge of the map
function IsPlayerAlive(p) {
    if (p.pos.x < 0 || p.pos.x >= params.gridSize || p.pos.y < 0 || p.pos.y >= params.gridSize)
        return false;
    else if (tailArray[p.pos.x][p.pos.y].type === CellTypes.Wall)
        return false;
    else if (tailArray[p.pos.x][p.pos.y].type === CellTypes.Tail) //check for collision with other snake tails
        return false;

    return true;
}

function checkWinConditions() 
{
    var lastAliveId = 0;
    var numAlive = 0;

    players.forEach(function (p) 
    {
        if (p.enabled && p.alive) 
        {
            lastAliveId = p.id;
            numAlive++;
        }
    });

    if (numAlive === 0) 
    {
        gameInProgress = false;
        winnerId = -1;
        printWinMessage = true;

        draw();
        resetGame();
        setTimeout(startRoundTimeout, 3000);
    }
    else if (numAlive === 1) 
    {
        gameInProgress = false;
        winnerId = lastAliveId;
        printWinMessage = true;
        players[winnerId].wins++;

        updatePlayerScore(winnerId);
        draw();
        resetGame();

        if (players[winnerId].wins === params.cupWinLimit)
            setTimeout(endGameTimeout, 6500);
        else
            setTimeout(startRoundTimeout, 3000);

    }
}


function triggerBomb(x, y) {
    var minX = x - params.bombRadius; var minY = y - params.bombRadius;
    var maxX = x + params.bombRadius; var maxY = y + params.bombRadius;

    for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++)
        {
            let clampX = clampNum(x);
            let clampY = clampNum(y)
            if (tailArray[clampX][clampY].type != CellTypes.Wall)
                tailArray[clampX][clampY].type = CellTypes.Bomb;
        }
}

function updateBattleRoyaleState() {
    wallEncroachment += params.wallEncroachmentInc;
    for (let y = 0; y < params.gridSize; y++) 
    {
        for (let x = 0; x < params.gridSize; x++) 
        {
            if (x < wallEncroachment || x >= (params.gridSize - wallEncroachment)
                || y < wallEncroachment || y >= (params.gridSize - wallEncroachment))
                tailArray[x][y].type = CellTypes.Wall;
            else
                tailArray[x][y].type = CellTypes.None;
        }
    }
}

function resetGame() {
    declareTailArray();

    players.forEach(function (p) 
    {
        p.alive = p.enabled;
        p.direction = p.startDirection;
        p.ready = false;
		p.pos = propPosToGrid(p.startPos);
        p.bombCharge = 0;
        p.sprintCharge = 0;
    });

    wallEncroachment = 0;
    if (battleRoyalTimer != null)
        clearInterval(battleRoyalTimer);

    for (let i = 0; i < params.gridSize; i++)
        for (let j = 0; j < params.gridSize; j++)
            tailArray[i][j] = { type: CellTypes.None, id: -1 };
		
	if(gameModes.noTailZonesEnabled)
	{
		SpawnNoTailZones();
	}
    if(gameModes.fastZonesEnabled)
    {
        SpawnFastZones();
    }

}

////=====DRAWING FUNCTIONS======//////
function drawGrid() 
{
    ctx.fillStyle = params.gridColor;
    for (let i = 1; i < params.gridSize; i++) 
    {
        ctx.fillRect(i * currentBlockSize, 0, 1, canvas.width);
        ctx.fillRect(0, i * currentBlockSize, canvas.height, 1);
    }

}

function drawSquare(x, y, width, color) 
{
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, width);
}

function drawTriangle(x1, y1, x2, y2, x3, y3, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.fill();
}

function drawPlayerHead(x, y, width, color, direction) 
{
    if(direction === Direction.Down){
        drawTriangle(x, y, x+currentBlockSize, y, x+currentBlockSize/2, y+currentBlockSize/2, color);
    }
    else if(direction === Direction.Up){
        drawTriangle(x, y+currentBlockSize, x+currentBlockSize, y+currentBlockSize, x+currentBlockSize/2, y+currentBlockSize/2, color);
    }
    else if(direction === Direction.Left){
        drawTriangle(x+currentBlockSize, y, x+currentBlockSize, y+currentBlockSize, x+currentBlockSize/2, y+currentBlockSize/2, color);
    }
    else if(direction === Direction.Right){
        drawTriangle(x, y, x, y+currentBlockSize, x+currentBlockSize/2, y+currentBlockSize/2, color);
    }
    else{        
        console.warn(`Unkown direction: '${direction}'. Something really messed up is happenign`);
    }
}

function drawBackground() 
{
    for (let i = 0; i < params.gridSize; i++)
        for (let j = 0; j < params.gridSize; j++) 
        {
            if((i+j)%2) drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, params.backgroundColor);
            else drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, params.backgroundColor2);
        }
}
function draw() {
    drawBackground();
    drawGrid();

    //draw tails
    for (let i = 0; i < params.gridSize; i++)
        for (let j = 0; j < params.gridSize; j++) 
        {
            if (tailArray[i][j].type === CellTypes.Tail)
                drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, players[tailArray[i][j].id].color);
            else if (tailArray[i][j].type === CellTypes.Bomb)
                drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, "#f00000");
            else if (tailArray[i][j].type === CellTypes.Wall)
                drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, "#000000");
            else if (tailArray[i][j].type === CellTypes.NoTailZone)
                drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, "#6633dd");
            else if (tailArray[i][j].type === CellTypes.FastZone)
                drawSquare(i * currentBlockSize, j * currentBlockSize, currentBlockSize, "#e0842d");
        }
    //draw heads
    players.forEach(function (p) 
    {
        if (p.enabled)
            drawPlayerHead(p.pos.x * currentBlockSize, p.pos.y * currentBlockSize, currentBlockSize, p.color, p.direction);
    });

    if (printWinMessage) 
    {
        let textOverlayButton = document.getElementById("textOverlayButton");
        if (winnerId === -1)
        {
            textOverlayButton.innerText = "Draw... You all suck";
        }
        else if (players[winnerId].wins === params.cupWinLimit) 
        {
            textOverlayButton.innerText = `${players[winnerId].name} WINS THE CUP!`;
        }
        else 
        {
            textOverlayButton.innerText = `${players[winnerId].name} Wins!!!!`;
        }
        $('#textOverlay').css("display", "flex");
    }
}

function SpawnNoTailZones()
{
	var num = Math.random()*12;
	for(var i=0;i<num;i++)
	{
		var xPos = Math.floor(Math.random()*(params.gridSize+8))-8;
		var yPos = Math.floor(Math.random()*(params.gridSize+8))-8;
		var size = Math.floor(Math.random()*8);
		FillGridSquare(CellTypes.NoTailZone, xPos, yPos, size);
	}
}

function SpawnFastZones()
{
	var num = Math.random()*5;
	for(var i=0; i < num; i++)
	{
		var xPos = Math.floor(Math.random()*(params.gridSize));
		var yPos = Math.floor(Math.random()*(params.gridSize));
        let vertical = Math.floor(Math.random()*100)%2;
        if(vertical){
            for(var y=0; y<params.gridSize; y++)
                tailArray[clampNum(y)][clampNum(xPos)].type = CellTypes.FastZone;
        }else{
            for(var x=0; x<params.gridSize; x++)
                tailArray[clampNum(yPos)][clampNum(x)].type = CellTypes.FastZone;
        }
	}
}

function FillGridSquare(celltype, x, y, size)
{
	for(var i=y; i < y+size && i<params.gridSize; i++)
	{
		for(var j=x; j < x+size && j < params.gridSize; j++)
		{   
			tailArray[clampNum(i)][clampNum(j)].type = celltype;
		}
	}
}

function isValidPosition(x, y){
    return x >= 0 && x < params.gridSize && y >= 0 && y < params.gridSize;
}

function onStartButtonPressed() 
{
    if(players.some(x => x.enabled && (x.name === '')))
    {
        alert('Please select a name!');
        return;
    }

    if (currConfigCntrls) return;

    players.forEach(function (p) {
        p.wins = 0;
        updatePlayerScore(p.id);
    });

    if (players.filter(x=>x.enabled).length >= 2) 
    {
        $("#startGameButton").css("display", "none");

		resetGame();
        draw();

        setTimeout(startRoundTimeout, 0);
    }
}

function startRoundTimeout() 
{
    $("#textOverlay").css("display", "none");
    printWinMessage = false;
    gameInProgress = true;
    waitingForReady = true;

    if (gameModes.brModeEnabled)
        battleRoyalTimer = setInterval(updateBattleRoyaleState, params.wallEncroachmentTime);

    draw();
}
function endGameTimeout() 
{
    $("#textOverlay").css("display", "none");
    $("#startGameButton").css("display", "flex");
}

function onResize() 
{
    //Not doing anything with this at the moment.
    //console.log($(window).width().toString() + "x" + $(window).height().toString());
}

function loadStorage(){
    let storedPlayers = getStorageItem('players', players[0].version);
    let storedParams = getStorageItem('params', params.version);
    let storedModes = getStorageItem('gameModes', gameModes.version);
    if(storedPlayers) players = storedPlayers;
    if(storedParams) params = storedParams;
    if(storedModes) gameModes = storedModes;

    $('.player-card-overlay').each(function(i,x){
        $(this).css("display", players[i].enabled ? "none" : "flex");
    });
    $('.name-input').each(function (i, x){
        $(this).val(players[i].name);
    });
    Object.keys(gameModes).filter(x => x !== 'version').forEach(x => {
        let checkbox = document.getElementById(`param-${x}`);
        if(!checkbox){ console.warn(`Can't find param element with id: #param-${x}. What's going on there?`);return;}
        checkbox.checked = gameModes[x];
    });

    document.getElementById("gridSizeSlider").value = params.gridSize;
    document.getElementById("maxFpsSlider").value = params.maxFps;
    onChangeGridSize(params.gridSize);
}

function updateStorage(){
    window.localStorage.setItem('players', JSON.stringify(players));
    window.localStorage.setItem('params', JSON.stringify(params));
    window.localStorage.setItem('gameModes', JSON.stringify(gameModes));
}

function clearStorage(){
    window.localStorage.removeItem('players');
    window.localStorage.removeItem('params');
    window.localStorage.removeItem('gameModes');
}

function getStorageItem(itemKey, currentVersion){
    let storedObject = JSON.parse(window.localStorage.getItem(itemKey));
    if(storedObject){
        if((storedObject.version || storedObject[0].version) !== currentVersion){
            window.localStorage.removeItem(itemKey);
            return null;
        }
        return storedObject;
    }
}

function resetSliders(){
    params.gridSize = 50;
    params.maxFps = 18;
    updateStorage();
    loadStorage();
}

function getAndHideConfigButtons() //Go and find the hidden buttons used for configuring controls
{
    configButtons = $(".config-button");
    configButtons.each(function (b) 
    {
        $(this).css("display", "none");
    });
}

function updateSprintAndBombBars() 
{
    players.forEach(function (p) {
        $("#player" + p.id.toString() + " .bomb").css("width", ((p.bombCharge / params.bombRechargeTime) * 100).toString() + "%");
        $("#player" + p.id.toString() + " .sprint").css("width", ((p.sprintCharge / params.sprintRechargeTime) * 100).toString() + "%");
    });
}

function updatePlayerScore(id) 
{
    $("#player" + id.toString() + " .win-count").html(players[id].wins.toString());
}

function onAddPlayer(elem, index) 
{
    players[index].enabled = true;
	players[index].pos = propPosToGrid(players[index].startPos);

    $(elem + " .overlay").css("display", "none");
    updateStorage();
}

function onRemovePlayer(elem, index) 
{
    players[index].enabled = false;
    players[index].alive = false;

    $(elem + " .overlay").css("display", "flex");
    updateStorage();
}

function onConfigPlayer(elem, index) 
{
    if (gameInProgress || currConfigCntrls) 
        return;

    currConfigCntrls = true;
    currButtonConfig = 0;
    $(configButtons[0]).css("display", "flex");
    currPlyrConfig = players[index];

    $("#startGameButton").css("display", "none");
}

function onCancelCup()
{
    gameInProgress = false;
    resetGame();
    draw();
    $("#startGameButton").css("display", "flex");
}

function onChangeGridSize(value)
{
    var parseResult = parseInt(value);
    if(parseResult !== NaN) params.tempGridSize = parseResult;

    if(!gameInProgress)
    {
        params.gridSize = parseResult;
        resetGame();
        draw();
    }
    updateStorage();
}

function onChangeFrameRate(value)
{
    var parseResult = parseInt(value);
    if(parseResult !== NaN) params.maxFps = parseResult;
    updateStorage();
}

function initialize() 
{
    canvas = document.getElementById("snake_canvas");
    ctx = canvas.getContext("2d");

    getAndHideConfigButtons();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', onResize);

    $('.name-input').bind('input', function (event) 
    { //bind name change function to each player name textbox
        players[$(this).data()["player"]].name = $(this).val();
        updateStorage();
    });
    $(".card").each(function (index) 
    { //set card-header colors...
        $(this).children(".card-header").css("background-color", players[index].color);
    });

    declareTailArray();
    drawBackground();
    drawGrid();
    updateSprintAndBombBars();
    loadStorage();
}

function mainLoop(timestamp) 
{
    //clamp the framerate...
    if (timestamp < lastFrameMs + (1000 / params.maxFps)) 
    {
        requestAnimationFrame(mainLoop);
        return;
    }
    deltaTime = timestamp - lastFrameMs;
    lastFrameMs = timestamp;

    iteratePlayerState();
    updateSprintAndBombBars();
    checkCollisions();
    checkWinConditions();
    if(gameInProgress)
    {
        draw();
        requestAnimationFrame(mainLoop);
    }
}

$(document).ready(initialize);