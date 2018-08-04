'use strict'
////=====CANVAS DATA=====/////
var sizes = [100,200,300,400,500,600,700,800,900,1000,1100,1200];
var canvas;
var ctx;
////=====ANIMATION DATA==/////
var lastFrameMs = 0;
var maxFps = 20;
////=====KEY DATA========////////
var keysPressed = {"37":false,"38":false,"39":false,"40":false,"87":false,"65":false,"83":false,"68":false};
////=====SNAKE DATA======//////
var gameInProgress = true; //this is briefly set to true for testing porpoises...
var printWinnerText = false;
var winnerId = -1;
var gridSize = 100;
var gameIteration = 0;

// declare tail collision array
var tailArray = new Array(gridSize);
for(let i=0; i<gridSize;i++)
    tailArray[i] = new Array(gridSize);
for(let i=0;i<gridSize;i++)
    for(let j=0; j<gridSize;j++)
        tailArray[i][j] = {isTail: false, id:-1};


var players = [];
players[0] = createPlayer(0,{x:75,y:75}, "#e6194b", {"up":38,"down":40,"left":37,"right":39});
players[1] = createPlayer(1,{x:25,y:25}, "#3cb44b", {"up":87,"down":83,"left":65,"right":68});
players[2] = createPlayer(2,{x:25,y:25}, "#ffe119", {"up":87,"down":83,"left":65,"right":68});
players[3] = createPlayer(3,{x:11,y:11}, "#0082c8", {"up":87,"down":83,"left":65,"right":68});

function createPlayer(id, startPos,color,keyMapping)
{
    var player          = {};
    player.id           = id;
    player.enabled      = false;
    player.alive        = false;
    player.ready        = false;
    player.pos          = startPos;
    player.tempPos      = startPos;
    player.startPos     = startPos; //used for resetting after a game has ended lad....
    player.color        = color;
    player.direction    = {x: 1, y: 0};
    player.keyMapping   = keyMapping;
    player.name         = "Choose Name";
    return player;
}

function handleKeyDown(e)
{
    if(keysPressed[e.keyCode.toString()] != null)
        keysPressed[e.keyCode.toString()] = true;
}

function handleKeyUp(e)
{
    if(keysPressed[e.keyCode.toString()] != null)
        keysPressed[e.keyCode.toString()] = false; 
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
    players.forEach(function(p){
        if(p.enabled && p.alive)
        {
            //update the tail array for the previous position
            tailArray[p.pos.x][p.pos.y].isTail    = true;
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
            {
                console.log("you've hit a wall mate...")
                p.alive = false;
            }
            //check for collision with other snake tails
            else if( tailArray[p.pos.x][p.pos.y].isTail )
            {
                console.log(tailArray[p.pos.x][p.pos.y]);
                console.log("you're dead lad....");
                p.alive = false;
            }
            //check for collision with other snake heads
            players.forEach(function(p2){
                if(p2.id != p.id && posEqual(p2.pos, p.pos))
                {
                    console.log("you've hit another head lad...");
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
        gameInProgess = false;
        winnerId = -1;
    }
    else if(numAlive == 1)
    {
        gameInProgress = false;
        winnerId = lastAliveId;
    }
}

////=====DRAWING FUNCTIONS======//////
function drawSquare(x,y,width,color)
{
    ctx.fillStyle = color;
    ctx.fillRect(x,y, width, width);    
}
function draw()
{
    //clear the canvas
    canvas.width += 0;
    var currentBlockSize = canvas.height / gridSize;
    //draw tails
    for(let i=0;i<gridSize;i++)
        for(let j=0; j<gridSize;j++)
        {
            if(tailArray[i][j].isTail)
            {
                drawSquare(i*currentBlockSize,j*currentBlockSize,currentBlockSize, players[tailArray[i][j].id].color);
            }
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
            ctx.fillText(players[winnerId].name+"Wins!",(canvas.width/2-0.12*canvas.width),(canvas.height/2-0.0*canvas.height));
        }
    }
}

//this is just for testing porpoises...
players[0].enabled = true;
players[0].alive = true;
players[1].enabled = true;
players[1].alive = true;

function mainLoop(timestamp)
{    
    //clamp the framerate...
    if(timestamp < lastFrameMs+(1000/maxFps))
    {
        requestAnimationFrame(mainLoop);
        return;
    }
    lastFrameMs = timestamp;

    iteratePlayerState();
    //console.log(players[0].position);
    checkCollisions();
    checkWinConditions();
    draw();

    if(gameInProgress)
        requestAnimationFrame(mainLoop);
}

var w = window;
var requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;

function initialize()
{
    canvas = document.getElementById("snake_canvas");
    ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#92B901";
    ctx.fillRect(50, 50, 100, 100);
    console.log("alright lad mate");

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    requestAnimationFrame(mainLoop);
}

$(document).ready(initialize);

console.log(players);


