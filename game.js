import { poseService } from './core/input/pose-service.js';

const {
  init,
  GameLoop,
  Sprite,
  Text
} = kontra;

let { canvas, context } = init('game');

canvas.width = 1000;
canvas.height = 500;

//////////////////////////////////////////////////////
// BACKGROUND
//////////////////////////////////////////////////////

const bgImage = new Image();
bgImage.src = './assets/background.png';

let bgX = 0;

//////////////////////////////////////////////////////
// AUDIO
//////////////////////////////////////////////////////

const jumpSound = new Audio('./assets/jump.wav');
const hitSound = new Audio('./assets/hit.wav');
const music = new Audio('./assets/music.mp3');

music.loop = true;
music.volume = 0.3;

//////////////////////////////////////////////////////
// GAME STATE
//////////////////////////////////////////////////////

let gameStarted = false;
let gameOver = false;
let score = 0;
let blinkCooldown = false;

// GROUND_Y means the TOP of the ground
const PLAYER_GROUND_Y = 225;
const VISUAL_GROUND_Y = 400;

//////////////////////////////////////////////////////
// PLAYER
//////////////////////////////////////////////////////
const COLLISION_OFFSET_X = 125;
const COLLISION_OFFSET_Y = 175;

const player = Sprite({
  x: 120,
  y: PLAYER_GROUND_Y - 50,
  width: 50,
  height: 50,
  color: '#f78feb',

  dy: 0,
  gravity: 0.8,
  jumpForce: -15,

  update() {
    this.dy += this.gravity;
    this.y += this.dy;

    // keep player on top of ground
    if (this.y > PLAYER_GROUND_Y - this.height) {
      this.y = PLAYER_GROUND_Y - this.height;
      this.dy = 0;
    }
  },

  render() {
    context.fillStyle = this.color;

    context.save();

    context.translate(this.x + this.width / 2, this.y + this.height / 2);
    context.rotate(this.dy * 0.03);

    context.fillRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height
    );

    context.restore();
  },

  jump() {
    if (this.y >= PLAYER_GROUND_Y - this.height) {
      this.dy = this.jumpForce;
      jumpSound.currentTime = 0;
      jumpSound.play();
    }
  }
});

function resetGame() {
  gameStarted = false;
  gameOver = false;
  score = 0;
  bgX = 0;
  obstacles = [];

  player.x = 120;
  player.y = PLAYER_GROUND_Y - 50;
  player.dy = 0;

  scoreText.text = 'Score: 0';

  music.pause();
  music.currentTime = 0;
}
//////////////////////////////////////////////////////
// OBSTACLES
//////////////////////////////////////////////////////

let obstacles = [];

function createObstacle() {
  const obstacleHeight = 70;

  obstacles.push({
    x: canvas.width,
    y: VISUAL_GROUND_Y - obstacleHeight,
    width: 40,
    height: obstacleHeight,
    speed: 7
  });
}

function spawnObstacle() {
  if (!gameOver && gameStarted) {
    createObstacle();
  }

  // random next spawn time
  const nextSpawn = Math.random() * 1200 + 800;

  setTimeout(spawnObstacle, nextSpawn);
}

spawnObstacle();
//////////////////////////////////////////////////////
// SCORE TEXT
//////////////////////////////////////////////////////

const scoreText = Text({
  text: 'Score: 0',
  x: 20,
  y: 20,
  color: 'white',
  font: '32px Arial'
});

//////////////////////////////////////////////////////
// GAME LOOP
//////////////////////////////////////////////////////

const loop = GameLoop({

  update() {
    if (gameOver) return;

    if (gameStarted) {
      bgX -= 2;

      if (bgX <= -canvas.width) {
        bgX = 0;
      }
      
      score += 0.05;
      scoreText.text = 'Score: ' + Math.floor(score);

      player.update();

      obstacles.forEach(obstacle => {
        obstacle.x -= obstacle.speed;

        // collision
        const playerHitbox = {
          x: player.x + COLLISION_OFFSET_X,
          y: player.y + COLLISION_OFFSET_Y,
          width: player.width,
          height: player.height
        };

        const obstacleHitbox = {
          x: obstacle.x + 10,
          y: obstacle.y + 20,
          width: obstacle.width - 20,
          height: obstacle.height - 20
        };

        if (
          playerHitbox.x < obstacleHitbox.x + obstacleHitbox.width &&
          playerHitbox.x + playerHitbox.width > obstacleHitbox.x &&
          playerHitbox.y < obstacleHitbox.y + obstacleHitbox.height &&
          playerHitbox.y + playerHitbox.height > obstacleHitbox.y
        ) {
          gameOver = true;

          music.pause();
          hitSound.play();
        }
      });

      obstacles = obstacles.filter(o => o.x > -100);
    }
  },

  render() {
    // scrolling background
    context.drawImage(bgImage, bgX, 0, canvas.width, canvas.height);
    context.drawImage(bgImage, bgX + canvas.width, 0, canvas.width, canvas.height);

    // ground
    context.fillStyle = '#333';
    context.fillRect(0, VISUAL_GROUND_Y, canvas.width, canvas.height - VISUAL_GROUND_Y);

    // obstacles
    context.fillStyle = '#ff0055';

    obstacles.forEach(o => {
      context.beginPath();

      context.moveTo(o.x, o.y + o.height);
      context.lineTo(o.x + o.width / 2, o.y);
      context.lineTo(o.x + o.width, o.y + o.height);

      context.closePath();
      context.fill();
    });

    player.render();

    scoreText.render();

    if (!gameStarted) {
      context.fillStyle = 'white';
      context.font = '40px Arial';

      context.fillText(
        'NOD TO START',
        330,
        200
      );
    }

    if (gameOver) {
      context.fillStyle = 'red';
      context.font = '50px Arial';

      context.fillText(
        'GAME OVER',
        330,
        200
      );

      context.font = '30px Arial';

      context.fillText(
        'Press R to restart',
        360,
        260
      );
    }
  }
});

//////////////////////////////////////////////////////
// START / HEAD MOVEMENT INPUT
//////////////////////////////////////////////////////

let stillTime = 0;

poseService.subscribe((poses) => {
  if (!poses || gameOver) return;

  const pose = poses[0];
  if (!pose) return;

  const nose = pose.keypoints.find(k => k.name === "nose");
  const leftEye = pose.keypoints.find(k => k.name === "left_eye");
  const rightEye = pose.keypoints.find(k => k.name === "right_eye");

  if (!nose || !leftEye || !rightEye) return;

  const eyeLevel = (leftEye.y + rightEye.y) / 2;

  const movement = Math.abs(eyeLevel - (window.lastEyeLevel || eyeLevel));
  window.lastEyeLevel = eyeLevel;

  // start game
  if (!gameStarted) {
    if (movement > 12 && !blinkCooldown) {
      blinkCooldown = true;

      gameStarted = true;
      music.play();
      window.lastEyeLevel = null;

      setTimeout(() => {
        blinkCooldown = false;
      }, 800);
    }

    return;
  }

  // jump
  if (movement > 6 && !blinkCooldown) {
    blinkCooldown = true;
    player.jump();

    setTimeout(() => {
      blinkCooldown = false;
    }, 250);
  }
});

window.addEventListener('keydown', (r) => {
  if (r.key.toLowerCase() === 'r' && gameOver) {
    resetGame();
  }
});
loop.start();
