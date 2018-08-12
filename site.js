'use strict';
////=====CANVAS DATA=====/////
var canvas;
var ctx;
var backgroundColor     = "#333333";
var gridColor           = "#111111";
var currentBlockSize;
////=====ANIMATION DATA==/////
var lastFrameMs         = 0;
var maxFps              = 20;
var deltaTime           = 0;
////=====KEY DATA========////////
var keysPressed         = Array(256).fill(false);
////=====SNAKE DATA======//////

var gameModes = 
{
    brModeEnabled: true,
    sprintModeEnabled: true,
    holeySprintMode: false,
    wrapEnabled: false,
    bombModeEnabled: true
};

//timer for updating battle royale state at arbitrary intervals.
var battleRoyalTimer    = null;

//game parameters
var wallEncroachmentInc = 6;
var wallEncroachmentTime= 3500;
var wallEncroachment    = 0;
var bombRadius          = 5;
var sprintLength        = 1000;
var sprintRechargeTime  = 10000; //10 seconds (ms)
var bombRechargeTime    = 10000;
var cupWinLimit         = 3;
var gridSize            = 100;
//game state variables
var gameInProgress      = false;
var waitingForReady     = false;
var playOnPlayersReady  = true;
var printWinMessage     = false;
var numPlayers          = 0;
var numReady            = 0;
var winnerId            = -1;

var CellTypes = 
{
    None: 0,
    Tail: 1,
    Wall: 2,
    Bomb: 3
}

// declare tail collision array
var tailArray = new Array(gridSize);
for(let i=0; i<gridSize;i++)
    tailArray[i] = new Array(gridSize);
for(let i=0;i<gridSize;i++)
    for(let j=0; j<gridSize;j++)
        tailArray[i][j] = { type: CellTypes.None, id:-1};

var players = [];
players[0] = createPlayer(0,{x:25,y:25}, "#3cb44b", {"up":87,"down":83,"left":65,"right":68, "sprint":20, "bomb": 16});
players[1] = createPlayer(1,{x:75,y:75}, "#e6194b", {"up":38,"down":40,"left":37,"right":39, "sprint":46, "bomb": 35});
players[2] = createPlayer(2,{x:75,y:25}, "#ffe119", {"up":89,"down":72,"left":71,"right":74, "sprint":67, "bomb": 86});
players[3] = createPlayer(3,{x:25,y:75}, "#0082c8", {"up":80,"down":59,"left":76,"right":222, "sprint":188, "bomb": 190});

function createPlayer(id, startPos,color,keyMapping)
{
    var player              = {};
    player.id               = id;
    player.enabled          = false;
    player.alive            = false;
    player.ready            = false;
    player.pos              = newPos(startPos);
    player.tempPos          = newPos(startPos);
    player.startPos         = newPos(startPos); //used for resetting after a game has ended lad....
    player.color            = color;
    player.direction        = {x: 1, y: 0};
    player.startDirection   = {x: 1, y: 0};
    player.keyMapping       = keyMapping;
    player.name             = "Choose Name";
    player.wins             = 0;
    player.bombCharge       = 0;
    player.sprintCharge     = 0;
    return player;
}

function checkMode(param)
{
    gameModes[param] = !gameModes[param];
}

function handleKeyDown(e)
{
    var keyCode = e.keyCode;
    keysPressed[keyCode] = true;
    if (keyCode == 37 || keyCode == 38 || keyCode == 39 || keyCode == 40 || keyCode == 32)
        e.preventDefault();
    
    if(waitingForReady)
    {
        players.forEach(function(p){ //this if statement is formatted REALLY badly but I'll fix that later...
            if  (p.ready == false                   &&
                (keyCode == p.keyMapping["up"]      || keyCode == p.keyMapping["left"]     ||     
                 keyCode == p.keyMapping["right"]   || keyCode == p.keyMapping["down"])     )     
            {
                p.ready = true;
                numReady++;
            }
        });

        if(numReady > numPlayers)
            numReady = numPlayers;

        console.log("numready: " + numReady.toString());
        console.log("numplayers: " + numPlayers.toString());
        if(numReady == numPlayers)
        {
            waitingForReady = false;
            setTimeout(requestAnimationFrame(mainLoop), 0);
        }
    }        
    
}

function handleKeyUp(e)
{
    keysPressed[e.keyCode] = false;
}

//functions for dealing with position objects...
function posEqual(pos1,pos2)
{
    if(pos1.x==pos2.x && pos1.y==pos2.y)
        return true;
    else
        return false;
}
function newPos(pos)
{
    return {x:pos.x,y:pos.y};
}

////=====MAIN GAME LOGIC FUNCTIONS======//////
function iteratePlayerState()
{
    for(let i=0;i<gridSize;i++)
        for(let j=0;j<gridSize;j++)
            if(tailArray[i][j].type == CellTypes.Bomb)
                tailArray[i][j].type = CellTypes.None;

    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            //increment bomb and sprint counters
            if(gameModes.bombModeEnabled && p.bombCharge < bombRechargeTime)
                p.bombCharge += 1000/maxFps;
                
            if(gameModes.sprintModeEnabled && p.sprintCharge < sprintRechargeTime)
                p.sprintCharge += 1000/maxFps;

            //update the tail array for the previous position
            tailArray[p.pos.x][p.pos.y].type      = CellTypes.Tail;
            tailArray[p.pos.x][p.pos.y].id        = p.id;

            if(keysPressed[ p.keyMapping[ "left" ] ])
                if(p.direction.x != 1 && (p.pos.x - 1) != p.tempPos.x)
                {
                    p.direction.x = -1;
                    p.direction.y = 0;
                }
            if(keysPressed[ p.keyMapping[ "right" ] ])
                if(p.direction.x != -1 && (p.pos.x + 1) != p.tempPos.x)
                {
                    p.direction.x = 1;
                    p.direction.y = 0;
                }
            if(keysPressed[ p.keyMapping[ "up" ] ])
                if(p.direction.y != 1 && (p.pos.y - 1) != p.tempPos.y)
                {
                    p.direction.x = 0;
                    p.direction.y = -1;
                }
            if(keysPressed[ p.keyMapping[ "down" ] ])
                if(p.direction.y != -1 && (p.pos.y + 1) != p.tempPos.y)
                {
                    p.direction.x = 0;
                    p.direction.y = 1;
                }

            p.tempPos = newPos(p.pos);

            p.pos.x += p.direction.x;
            p.pos.y += p.direction.y;

            if(gameModes.wrapEnabled)
            {
                if(p.pos.x >= gridSize) p.pos.x -= gridSize;
                if(p.pos.x < 0)         p.pos.x += gridSize;
                if(p.pos.y >= gridSize) p.pos.y -= gridSize;
                if(p.pos.y < 0)         p.pos.y += gridSize;
            }

            if(gameModes.bombModeEnabled && keysPressed[ p.keyMapping[ "bomb" ]] && p.bombCharge >= bombRechargeTime)
            {
                p.bombCharge = 0;
                triggerBomb(p.pos.x, p.pos.y);
            }
            if(gameModes.sprintModeEnabled && keysPressed[ p.keyMapping["sprint"]] && p.sprintCharge > 0.1*sprintRechargeTime)
            {
                if(!gameModes.holeySprintMode && (p.pos.x >= 0 && p.pos.x < gridSize && p.pos.y >= 0 && p.pos.y < gridSize) )
                {
                    tailArray[p.pos.x][p.pos.y].type      = CellTypes.Tail;
                    tailArray[p.pos.x][p.pos.y].id        = p.id;
                }
                p.pos.x += p.direction.x;
                p.pos.y += p.direction.y;

                p.sprintCharge -= deltaTime * sprintRechargeTime/sprintLength;
            }

        }
    });

    updateSprintAndBombBars();

}

function checkCollisions()
{
    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            if(tailArray[p.pos.x][p.pos.y].type == CellTypes.Wall)
                p.alive = false
            else if(p.pos.x < 0 || p.pos.x >= gridSize || p.pos.y < 0 || p.pos.y >= gridSize)
                p.alive = false;
            else if( tailArray[p.pos.x][p.pos.y].type == CellTypes.Tail ) //check for collision with other snake tails
                p.alive = false;
            
            players.forEach(function(p2){                                 //check for collision with other snake heads
                if(p2.enabled && p.alive && p2.id != p.id && posEqual(p2.pos, p.pos))
                {
                    p.alive = false;
                    p2.alive = false; //I update both here, but it's not actually necessary. It just saves performing another loop iteration
                }
            });
        }    
    });
}

function checkWinConditions()
{
    var lastAliveId = 0;
    var numAlive    = 0;

    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            lastAliveId = p.id;
            numAlive++;
        }
    });

    if(numAlive == 0)
    {
        gameInProgress  = false;
        winnerId        = -1;
        printWinMessage = true;

        draw();
        resetGame();
        setTimeout(startRoundTimeout, 3000);
    }
    else if(numAlive == 1)
    {
        gameInProgress  = false;
        winnerId        = lastAliveId;
        printWinMessage = true;
        players[winnerId].wins++;
        
        updatePlayerScore(winnerId);
        draw();  
        resetGame();

        if(players[winnerId].wins == cupWinLimit)
            setTimeout(endGameTimeout, 1500);
        else
            setTimeout(startRoundTimeout, 3000);   
            
    }
}

//needs validating
function triggerBomb(x,y)
{
    var minX = x-bombRadius; var minY = y-bombRadius;
    var maxX = x+bombRadius; var maxY = y+bombRadius;

    if(minX < 0) minX = 0;
    if(minY < 0) minY = 0;
    if(maxX >= gridSize) maxX = gridSize -1;
    if(maxY >= gridSize) maxY = gridSize -1;

    for(let y=minY; y<=maxY; y++)
        for(let x=minX; x<= maxX; x++)
            if( tailArray[x][y].type != CellTypes.Wall)
                tailArray[x][y].type = CellTypes.Bomb;
}
//needs validating.. also needs simplifying a bit.. you set things that already walls to be walls. that's a bit rubbish
function updateBattleRoyaleState()
{
    wallEncroachment += wallEncroachmentInc;
    for(let y=0; y < gridSize; y++)
    {
        for(let x=0; x < gridSize; x++)
        {
            if(    x < wallEncroachment || x >= (gridSize-wallEncroachment)
                || y < wallEncroachment || y >= (gridSize-wallEncroachment) )
                tailArray[x][y].type = CellTypes.Wall;
            else
                tailArray[x][y].type = CellTypes.None;
        }
    }
}

function resetGame()
{
    players.forEach(function(p){
        p.alive         = p.enabled;
        p.direction     = newPos(p.startDirection);
        p.ready         = false;
        p.pos           = newPos(p.startPos);
        p.bombCharge    = 0;
        p.sprintCharge  = 0;
    });

    wallEncroachment = 0;
    if(battleRoyalTimer != null)
        clearInterval(battleRoyalTimer);

    for(let i=0;i<gridSize;i++)
        for(let j=0; j<gridSize;j++)
            tailArray[i][j] = { type: CellTypes.None, id:-1};

}

////=====DRAWING FUNCTIONS======//////
function drawGrid()
{
    ctx.fillStyle = gridColor;
    for(let i=1;i<gridSize;i++)
    {
        ctx.fillRect(i*currentBlockSize, 0, 1, canvas.width);
        ctx.fillRect(0,i*currentBlockSize, canvas.height, 1);
    }

}
function drawSquare(x,y,width,color)
{
    ctx.fillStyle = color;
    ctx.fillRect(x,y, width, width);    
}
function drawBackground()
{
    ctx.fillStyle = "#333333";
    ctx.fillRect(0,0, canvas.height, canvas.width);    
}
function draw()
{
    drawBackground();
    drawGrid();

    //draw tails
    for(let i=0;i<gridSize;i++)
        for(let j=0; j<gridSize;j++)
        {
            if(tailArray[i][j].type == CellTypes.Tail)
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, players[tailArray[i][j].id].color);
            else if(tailArray[i][j].type == CellTypes.Bomb)
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, "#f00000");
            else if(tailArray[i][j].type == CellTypes.Wall)
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, "#000000");
        }
    //draw heads
    players.forEach(function(p){
        if(p.enabled && p.alive)
            drawSquare(p.pos.x*currentBlockSize,p.pos.y*currentBlockSize,currentBlockSize, p.color);
    });

    if(printWinMessage)
    {
        ctx.font = "30px Arial";
        if(winnerId == -1)
            ctx.fillText("Draw... You all suck ",(canvas.width/2-0.2*canvas.width),(canvas.height/2-0.2*canvas.height));
        else
        {
            ctx.fillStyle = players[winnerId].color;
            ctx.fillText(players[winnerId].name+" Wins!",(canvas.width/2-0.12*canvas.width),(canvas.height/2-0.0*canvas.height));
        }
    }
}

function onStartButtonPressed()
{
    //reset all the players' wins to 0
    players.forEach(function(p){
        p.wins = 0;
        updatePlayerScore(p.id);
    });

    if(numPlayers >= 2)
    {
        $("#startGameButton").css("display", "none");

        draw();

        players.forEach(function(p){
            p.alive = p.enabled;
        });

        setTimeout(startRoundTimeout, 0);
    }
}

function startRoundTimeout()
{
    printWinMessage = false;
    gameInProgress  = true;
    waitingForReady = true;
    numReady        = 0;
    
    if(gameModes.brModeEnabled)
        battleRoyalTimer = setInterval(updateBattleRoyaleState, wallEncroachmentTime);

    draw();
}
function endGameTimeout()
{
    $("#startGameButton").css("display", "flex");
}

function mainLoop(timestamp)
{    
    //clamp the framerate...
    if(timestamp < lastFrameMs+(1000/maxFps))
    {
        requestAnimationFrame(mainLoop);
        return;
    }
    deltaTime = timestamp - lastFrameMs;
    lastFrameMs = timestamp;

    iteratePlayerState();
    checkCollisions();
    checkWinConditions();
    draw();

    if(gameInProgress)
        requestAnimationFrame(mainLoop);
}

var w = window;
var requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;

function onResize()
{
    console.log($( window ).width().toString() + "x" + $( window ).height().toString());
}

function initialize()
{ 
    canvas = document.getElementById("snake_canvas");
    ctx = canvas.getContext("2d");
    currentBlockSize = canvas.height / gridSize;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', onResize);
    
    $('.name-input').bind('input', function(event){
        console.log($(this).data()["player"]);
        console.log( $(this).val() );
        players[ $(this).data()["player"] ].name = $(this).val();
    });
    $(".card").each(function(index){
        $(this).children(".card-header").css("background-color", players[index].color);
    });

    drawBackground();
    drawGrid();
    updateSprintAndBombBars();
}

function updateSprintAndBombBars()
{
    players.forEach(function(p){
        $("#player"+p.id.toString()+" .bomb").css("width", ((p.bombCharge/bombRechargeTime)*100).toString()+"%" );
        $("#player"+p.id.toString()+" .sprint").css("width", ((p.sprintCharge/sprintRechargeTime)*100).toString()+"%" );
    });
}

function updatePlayerScore(id)
{
    $( "#player" + id.toString() + " .win-count" ).html( players[id].wins.toString() );
}

function onAddPlayer(elem, index)
{
    numPlayers++;
    players[index].enabled = true;
    players[index].position = players[index].startPos;

    $(elem + " .overlay").css("display", "none");
}
function onRemovePlayer(elem, index)
{
    numPlayers--;
    players[index].enabled = false;
    players[index].alive = false;
    players[index].position = players[index].startPos;

    $(elem + " .overlay").css("display", "flex");
}

$(document).ready(initialize);