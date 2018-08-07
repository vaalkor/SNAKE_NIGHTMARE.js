'use strict';
////=====CANVAS DATA=====/////
var canvas;
var ctx;
var backgroundColor     = "#333333";
var gridColor           = "#111111";
////=====ANIMATION DATA==/////
var lastFrameMs         = 0;
var maxFps              = 20;
var deltaTime           = 0;
////=====KEY DATA========////////
var keysPressed         = Array(256).fill(false);
////=====SNAKE DATA======//////

var gameParams = 
{
    brModeEnabled: false,
    sprintModeEnabled: true,
    holeySprintMode: false,
    wrapEnabled: false,
    bombModeEnabled: true
};

var wallEncroachmentInc = 8;
var wallEncroachmentTime= 2500;
var wallEncroachment    = 0;
var battleRoyalTimer    = null;

var bombRadius          = 5;
var sprintLength        = 1000;
var sprintRechargeTime  = 10000; //10 seconds (ms)
var bombRechargeTime    = 10000;
var cupWinLimit         = 10;
var gridSize            = 100;
var gameIteration       = 0;
var winnerId            = -1;
var gameInProgress      = true;
var playOnPlayersReady  = true;



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
players[0] = createPlayer(0,{x:75,y:75}, "#e6194b", {"up":38,"down":40,"left":37,"right":39, "sprint":46, "bomb": 35});
players[1] = createPlayer(1,{x:25,y:25}, "#3cb44b", {"up":87,"down":83,"left":65,"right":68, "sprint":20, "bomb": 16});
players[2] = createPlayer(2,{x:75,y:25}, "#ffe119", {"up":87,"down":83,"left":65,"right":68, "sprint":46, "bomb": 35});
players[3] = createPlayer(3,{x:25,y:75}, "#0082c8", {"up":87,"down":83,"left":65,"right":68, "sprint":46, "bomb": 35});

function createPlayer(id, startPos,color,keyMapping)
{
    var player              = {};
    player.id               = id;
    player.enabled          = false;
    player.alive            = false;
    player.ready            = false;
    player.pos              = startPos;
    player.tempPos          = startPos;
    player.startPos         = startPos; //used for resetting after a game has ended lad....
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

function checkParam(param)
{
    gameParams[param] = !gameParams[param];
}

function handleKeyDown(e)
{
    keysPressed[e.keyCode] = true;
    if (e.keyCode == 37 || e.keyCode == 38 || e.keyCode == 39 || e.keyCode == 40 || e.keyCode == 32)
        e.preventDefault();
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
            if(gameParams.bombModeEnabled && p.bombCharge < bombRechargeTime)
            {
                p.bombCharge += 1000/maxFps;
                $("#player"+p.id.toString()+" .bomb").css("width", ((p.bombCharge/bombRechargeTime)*100).toString()+"%" );
            }
                
            if(gameParams.sprintModeEnabled && p.sprintCharge < sprintRechargeTime)
            {
                p.sprintCharge += 1000/maxFps;
                $("#player"+p.id.toString()+" .sprint").css("width", ((p.sprintCharge/sprintRechargeTime)*100).toString()+"%" );
            }
            //update the tail array for the previous position
            tailArray[p.pos.x][p.pos.y].type      = CellTypes.Tail;
            tailArray[p.pos.x][p.pos.y].id        = p.id;

            if(keysPressed[ p.keyMapping[ "left" ] ])
                if(p.direction.x != 1 && (p.pos.x - 1) != p.tempPosition.x)
                {
                    p.direction.x = -1;
                    p.direction.y = 0;
                }
            if(keysPressed[ p.keyMapping[ "right" ] ])
                if(p.direction.x != -1 && (p.pos.x + 1) != p.tempPosition.x)
                {
                    p.direction.x = 1;
                    p.direction.y = 0;
                }
            if(keysPressed[ p.keyMapping[ "up" ] ])
                if(p.direction.y != 1 && (p.pos.y - 1) != p.tempPosition.y)
                {
                    p.direction.x = 0;
                    p.direction.y = -1;
                }
            if(keysPressed[ p.keyMapping[ "down" ] ])
                if(p.direction.y != -1 && (p.pos.y + 1) != p.tempPosition.y)
                {
                    p.direction.x = 0;
                    p.direction.y = 1;
                }

            p.tempPosition = newPos(p.pos);

            p.pos.x += p.direction.x;
            p.pos.y += p.direction.y;

            if(gameParams.wrapEnabled)
            {
                if(p.pos.x >= gridSize) p.pos.x -= gridSize;
                if(p.pos.x < 0)         p.pos.x += gridSize;
                if(p.pos.y >= gridSize) p.pos.y -= gridSize;
                if(p.pos.y < 0)         p.pos.y += gridSize;
            }

            if(gameParams.bombModeEnabled && keysPressed[ p.keyMapping[ "bomb" ]] && p.bombCharge >= bombRechargeTime)
            {
                p.bombCharge = 0;
                triggerBomb(p.pos.x, p.pos.y);
            }
            if(gameParams.sprintModeEnabled && keysPressed[ p.keyMapping["sprint"]] && p.sprintCharge > 0.1*sprintRechargeTime)
            {
                if(!gameParams.holeySprintMode && (p.pos.x >= 0 && p.pos.x < gridSize && p.pos.y >= 0 && p.pos.y < gridSize) )
                {
                    tailArray[p.pos.x][p.pos.y].type      = CellTypes.Tail;
                    tailArray[p.pos.x][p.pos.y].id        = p.id;
                }
                p.pos.x += p.direction.x;
                p.pos.y += p.direction.y;

                p.sprintCharge -= deltaTime * sprintRechargeTime/sprintLength;
            }

            gameIteration++;
        }
    });

}

function checkCollisions()
{
    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            //check for collision with edge of map
            if(p.pos.x < 0 || p.pos.x >= gridSize || p.pos.y < 0 || p.pos.y >= gridSize)
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
    var numAlive = 0;

    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            lastAliveId = p.id;
            numAlive++;
        }
    });

    if(numAlive == 0)
    {
        gameInProgress = false;
        winnerId = -1;
    }
    else if(numAlive == 1)
    {
        gameInProgress = false;
        winnerId = lastAliveId;
        players[winnerId].wins++;

        if(players[winnerId].wins == cupWinLimit)
        {
            //CUP HAS BEEN WON!!! SICK MATE!!!
        }
    }
}

//needs validating
function triggerBomb(x,y)
{
    var minX = x-bombRadius; var minY = y-bombRadius;
    var maxX = x+bombRadius; var maxY = y+bombRadius;

    if(minX < 0) minX = 0;
    if(minY < 0) minY = 0;
    if(maxX >= gridSize)  maxX = gridSize -1;
    if(maxY >= gridSize) maxY = gridSize -1;

    for(let y=minY; y<=maxY; y++)
        for(let x=minX; x<= maxX; x++)
            if( tailArray[x][y].type != CellTypes.Wall)
                tailArray[x][y].type = CellTypes.Bomb;
}
//needs validating
function updateBattleRoyaleState()
{
    for(let y=0; y < gridSize; y++)
    {
        for(let x=0; x < gridSize; x++)
        {
            if(    x < wallEncroachment || x >= (gridSize-wallEncroachment)
                || y < wallEncroachment || y >= (gridSize-wallEncroachment) )
                tailArray[x][y].type = CellTypes.Wall;
            else
                tailArray[x][y].id = 0;
        }
    }
}

function resetGame()
{
    players.forEach(function(p){
        p.alive = true;
        p.direction = p.startDirection;
        p.ready = false;
        p.pos = p.startPos;
    });
    tailArray.forEach(function(g){
        g.type = CellTypes.None;
        g.isPartOfWall = false;
    });
}

////=====DRAWING FUNCTIONS======//////
function drawGrid(currentBlockSize)
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
function draw()
{
    //clear the canvas
    ctx.fillStyle = "#333333";
    ctx.fillRect(0,0, canvas.height, canvas.width);    

    var currentBlockSize = canvas.height / gridSize;
    drawGrid(currentBlockSize);

    //draw tails
    for(let i=0;i<gridSize;i++)
        for(let j=0; j<gridSize;j++)
        {
            if(tailArray[i][j].type == CellTypes.Tail)
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, players[tailArray[i][j].id].color);
            else if(tailArray[i][j].type == CellTypes.Bomb)
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, "#f00000");
            else if(tailArray[i][j].type == CellTypes.Wall)
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, "#0000f0");
        }
    //draw heads
    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            drawSquare(p.pos.x*currentBlockSize,p.pos.y*currentBlockSize,currentBlockSize, p.color);
        }
    });

    if(!gameInProgress)
    {
        ctx.font = "30px Arial";
        if(winnerId == -1)
        {
            ctx.fillText("Draw... You all suck ",(canvas.width/2-0.2*canvas.width),(canvas.height/2-0.2*canvas.height));
        }else{
            ctx.fillText(players[winnerId].name+" Wins!",(canvas.width/2-0.12*canvas.width),(canvas.height/2-0.0*canvas.height));
        }
    }
}

//this is just for testing porpoises...
players[0].enabled = true;
players[0].alive = true;
players[1].enabled = true;
players[1].alive = true;
/*players[2].enabled = true;
players[2].alive = true;
players[3].enabled = true;
players[3].alive = true;*/

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
    
    ctx.fillStyle = "#92B901";
    ctx.fillRect(50, 50, 100, 100);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', onResize);
    
    $('.name-input').bind('input', function(event){
        players[ $(this).data()["player"] ].name = $(this).val();
    });
    $(".card").each(function(index){
        $(this).children(".card-header").css("background-color", players[index].color);
    });

    requestAnimationFrame(mainLoop);
}

function onAddPlayer(elem, index)
{
    players[index].enabled = true;
    players[index].position = players[index].startPos;

    $(elem + " .overlay").css("display", "none");
}
function onRemovePlayer(elem, index)
{
    players[index].enabled = false;
    players[index].alive = false;
    players[index].position = players[index].startPos;

    $(elem + " .overlay").css("display", "flex");
}

$(document).ready(initialize);