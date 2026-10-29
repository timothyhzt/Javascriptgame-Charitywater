(() => {
  'use strict';

  // Adjust movement, jump arc, platform spacing, and generation distance here.
  const TUNE = {
    gravity: 1500,
    moveSpeed: 340,
    moveAcceleration: 2300,
    jumpVelocity: 650,
    playerWidth: 25,
    playerHeight: 35,
    platformGap: 92,
    dropletSpawnChance: 0.62,
    extraDropletChance: 0.3,
    fallLimit: 220,
    generationAhead: 1200,
    platformSizing: {
      referenceWidth: 1100,
      minimumScale: 0.62,
      maximumScale: 1,
      startingWidth: 320,
      startingMinimumWidth: 180,
      startingMaximumRatio: 0.62,
      minimumWidth: 88,
      maximumWidth: 235,
      minimumRatio: 0.24,
      maximumRatio: 0.58
    },
    maxDt: 0.033
  };

  const COLORS = {
    player: '#62e8e2',
    playerHighlight: '#dffaff',
    playerShadow: '#09203d',
    accent: '#ffd27d',
    particle: '#b9ffff',
    platformTop: '#8ee1d6',
    station: '#ffd27d',
    stationOpening: '#143154',
    pollution: '#6f7b68',
    pollutionHighlight: '#b6c48d',
    pollutionWarning: '#ff806f',
    tankWater: '#62d9e8'
  };

  const canvas = document.getElementById('gameCanvas');
  const context = canvas.getContext('2d');
  const keys = new Set();

  const ui = {
    storedValue: document.getElementById('storedValue'),
    unbankedValue: document.getElementById('unbankedValue'),
    heightValue: document.getElementById('heightValue'),
    scoreValue: document.getElementById('scoreValue'),
    startScreen: document.getElementById('startScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    winScreen: document.getElementById('winScreen'),
    fallScreen: document.getElementById('fallScreen'),
    messageStack: document.getElementById('messageStack')
  };

  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  class Particle {
    constructor(x, y, color, speed = 120) {
      this.x = x;
      this.y = y;
      this.life = 1;
      this.color = color;
      this.velocityX = randomBetween(-speed, speed);
      this.velocityY = randomBetween(-speed, speed);
      this.size = randomBetween(2, 5);
    }

    update(deltaTime) {
      this.life -= deltaTime * 1.7;
      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;
      this.velocityY += 260 * deltaTime;
    }

    draw(camera) {
      context.globalAlpha = Math.max(0, this.life);
      context.fillStyle = this.color;
      context.fillRect(this.x - camera.x, this.y - camera.y, this.size, this.size);
      context.globalAlpha = 1;
    }
  }

  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.velocityX = 0;
      this.velocityY = 0;
      this.width = TUNE.playerWidth;
      this.height = TUNE.playerHeight;
      this.grounded = false;
      this.coyoteTime = 0;
      this.jumpBuffer = 0;
      this.squash = 1;
      this.lastJumpKey = false;
      this.lastLand = false;
    }

    update(game, deltaTime) {
      this.updateHorizontalMovement(deltaTime);
      this.updateJump(game, deltaTime);
      this.applyGravity(deltaTime);
      this.moveAndCollide(game, deltaTime);
      this.squash += (1 - this.squash) * deltaTime * 10;
    }

    updateHorizontalMovement(deltaTime) {
      const movingRight = keys.has('ArrowRight') || keys.has('d');
      const movingLeft = keys.has('ArrowLeft') || keys.has('a');
      const direction = Number(movingRight) - Number(movingLeft);
      const targetVelocity = direction * TUNE.moveSpeed;
      const maximumChange = TUNE.moveAcceleration * deltaTime;

      this.velocityX += clamp(targetVelocity - this.velocityX, -maximumChange, maximumChange);

      if (!direction) {
        this.velocityX *= Math.pow(0.0001, deltaTime);
      }
    }

    updateJump(game, deltaTime) {
      const jumpPressed = keys.has(' ') || keys.has('ArrowUp');

      this.jumpBuffer = Math.max(0, this.jumpBuffer - deltaTime);
      this.coyoteTime = this.grounded ? 0.11 : Math.max(0, this.coyoteTime - deltaTime);

      if (jumpPressed && !this.lastJumpKey) {
        this.jumpBuffer = 0.13;
      }
      this.lastJumpKey = jumpPressed;

      if (this.jumpBuffer && this.coyoteTime) {
        this.velocityY = -TUNE.jumpVelocity;
        this.grounded = false;
        this.coyoteTime = 0;
        this.jumpBuffer = 0;
        this.squash = 0.82;
        game.sound.beep(410, 0.08, 'sine');
      }

      // Releasing jump early trims the jump arc for variable-height jumps.
      if (!jumpPressed && this.velocityY < -190) {
        this.velocityY += 1000 * deltaTime;
      }
    }

    applyGravity(deltaTime) {
      this.velocityY += TUNE.gravity * deltaTime;
    }

    moveAndCollide(game, deltaTime) {
      const previousBottom = this.y + this.height;

      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;
      this.x = clamp(this.x, 8, game.worldWidth - this.width - 8);
      this.grounded = false;

      for (const platform of game.platforms) {
        const missesHorizontally = platform.x + platform.width < this.x || platform.x > this.x + this.width;
        const hasPassedPlatform = previousBottom > platform.y + 5;
        const isAbovePlatform = this.y + this.height < platform.y;

        if (missesHorizontally || hasPassedPlatform || isAbovePlatform || this.velocityY < 0) {
          continue;
        }

        this.y = platform.y - this.height;
        this.velocityY = 0;
        this.grounded = true;
        this.squash = 1.16;

        if (!this.lastLand) {
          game.sound.beep(180, 0.045, 'triangle');
        }
        this.lastLand = true;
        break;
      }

      if (!this.grounded) {
        this.lastLand = false;
      }
    }

    draw(camera) {
      const screenX = this.x - camera.x;
      const screenY = this.y - camera.y;
      const stretch = this.grounded ? this.squash : 0.9;

      context.save();
      context.translate(screenX + this.width / 2, screenY + this.height);
      context.scale(1 / stretch, stretch);

      context.fillStyle = COLORS.player;
      context.beginPath();
      context.ellipse(0, -18, 13, 18, 0, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = COLORS.playerHighlight;
      context.beginPath();
      context.arc(-4, -22, 3, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = COLORS.playerShadow;
      context.fillRect(-8, -31, 4, 5);
      context.fillRect(4, -31, 4, 5);

      context.fillStyle = COLORS.accent;
      context.fillRect(-11, -2, 8, 4);
      context.fillRect(3, -2, 8, 4);
      context.restore();
    }
  }

  class Sound {
    constructor() {
      this.context = null;
      this.muted = false;
    }

    init() {
      this.context ||= new AudioContext();
    }

    beep(frequency, duration, type = 'sine') {
      if (this.muted || !this.context) {
        return;
      }

      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);

      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    }
  }

  class Game {
    constructor() {
      this.worldWidth = 1100;
      this.platforms = [];
      this.droplets = [];
      this.particles = [];
      this.camera = { x: 0, y: 0 };
      this.sound = new Sound();
      this.state = 'start';
      this.stored = 0;
      this.unbanked = 0;
      this.score = 0;
      this.maxHeight = 0;
      this.winShown = false;
      this.lastTime = 0;
      this.time = 0;
      this.highestGenerated = 0;
      this.checkpoint = { x: 540, y: 510 };
      this.checkpointPlatform = null;
      this.player = new Player(this.checkpoint.x, this.checkpoint.y);

      this.resize();
      this.generateInitialLevel();
      this.bindEvents();
      requestAnimationFrame((time) => this.loop(time));
    }

    resetGame() {
      keys.clear();
      this.state = 'start';
      this.stored = 0;
      this.unbanked = 0;
      this.score = 0;
      this.maxHeight = 0;
      this.winShown = false;
      this.lastTime = 0;
      this.time = 0;
      this.highestGenerated = 0;
      this.checkpoint = { x: 540, y: 510 };
      this.checkpointPlatform = null;
      this.platforms = [];
      this.droplets = [];
      this.particles = [];
      this.camera = { x: 0, y: 0 };
      this.player = new Player(this.checkpoint.x, this.checkpoint.y);
      this.startingY = this.isNarrowViewport
        ? clamp(this.viewHeight * 0.72, 180, 570)
        : 570;
      this.generateInitialLevel();
      ui.startScreen.classList.remove('is-hidden');
      ui.pauseScreen.classList.add('is-hidden');
      ui.winScreen.classList.add('is-hidden');
      ui.fallScreen.classList.add('is-hidden');
      ui.messageStack.replaceChildren();
    }

    resize() {
      const deviceScale = Math.min(2, window.devicePixelRatio || 1);

      canvas.width = window.innerWidth * deviceScale;
      canvas.height = window.innerHeight * deviceScale;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      this.viewWidth = window.innerWidth;
      this.viewHeight = window.innerHeight;
      this.isNarrowViewport = this.viewWidth <= TUNE.platformSizing.referenceWidth;
      this.worldWidth = this.isNarrowViewport
        ? this.viewWidth
        : Math.max(TUNE.platformSizing.referenceWidth, this.viewWidth);
      this.ledgeScale = clamp(
        this.viewWidth / TUNE.platformSizing.referenceWidth,
        TUNE.platformSizing.minimumScale,
        TUNE.platformSizing.maximumScale
      );
      if (this.startingY === undefined) {
        this.startingY = this.isNarrowViewport
          ? clamp(this.viewHeight * 0.72, 180, 570)
          : 570;
      }
      this.levelPadding = this.isNarrowViewport
        ? clamp(this.viewWidth * 0.05, 12, 28)
        : 40;

      if (this.platforms.length) {
        this.scaleExistingLedges();
        this.constrainLevelToViewport();
      }
    }

    scaleExistingLedges() {
      for (const platform of this.platforms) {
        const previousX = platform.x;
        const previousWidth = platform.width;
        const center = platform.x + platform.width / 2;
        const difficulty = clamp((this.startingY - platform.y) / 1700, 0, 1);
        platform.width = this.getPlatformWidth({
          difficulty,
          isStartingPlatform: platform.isStartingPlatform,
          variation: platform.widthFactor ?? 0.5
        });
        platform.x = center - platform.width / 2;
        platform.baseX = platform.x;
        const widthRatio = previousWidth ? platform.width / previousWidth : 1;
        platform.height = clamp(platform.height * widthRatio, 12, 22);

        for (const droplet of this.droplets) {
          const belongsToPlatform = droplet.y >= platform.y - 46
            && droplet.y <= platform.y
            && droplet.x >= previousX
            && droplet.x <= previousX + previousWidth;

          if (belongsToPlatform) {
            droplet.x = platform.x + (droplet.x - previousX) * widthRatio;
          }
        }

        if (platform.pollution) {
          platform.pollution.offsetX *= widthRatio;
          platform.pollution.x = platform.x + platform.pollution.offsetX;
        }
      }
    }

    getPlatformWidth({ difficulty = 0, isStartingPlatform = false, variation = 0.5 } = {}) {
      const sizing = TUNE.platformSizing;
      const availableWidth = Math.max(0, this.worldWidth - this.levelPadding * 2);

      if (isStartingPlatform) {
        return Math.min(
          availableWidth,
          clamp(
            sizing.startingWidth * this.ledgeScale,
            sizing.startingMinimumWidth,
            this.viewWidth * sizing.startingMaximumRatio
          )
        );
      }

      const minimumWidth = clamp(
        (120 - difficulty * 20) * this.ledgeScale,
        sizing.minimumWidth,
        this.viewWidth * sizing.minimumRatio
      );
      const maximumWidth = clamp(
        (235 - difficulty * 30) * this.ledgeScale,
        minimumWidth,
        Math.min(sizing.maximumWidth, this.viewWidth * sizing.maximumRatio)
      );

      return Math.min(
        availableWidth,
        minimumWidth + (maximumWidth - minimumWidth) * clamp(variation, 0, 1)
      );
    }

    constrainLevelToViewport() {
      const maximumPlatformWidth = this.worldWidth - this.levelPadding * 2;

      for (const platform of this.platforms) {
        platform.width = Math.min(platform.width, maximumPlatformWidth);
        platform.x = clamp(platform.x, this.levelPadding, this.worldWidth - platform.width - this.levelPadding);
        platform.baseX = clamp(platform.baseX ?? platform.x, this.levelPadding, this.worldWidth - platform.width - this.levelPadding);
        platform.range = Math.min(platform.range || 0, Math.max(0, (this.worldWidth - platform.width) / 2 - this.levelPadding));

        if (this.checkpointPlatform && platform.y === this.checkpointPlatform.y) {
          this.checkpointPlatform = { ...platform };
        }

        if (platform.pollution) {
          platform.pollution.offsetX = clamp(
            platform.pollution.offsetX,
            8,
            Math.max(8, platform.width - platform.pollution.width - 8)
          );
          platform.pollution.x = platform.x + platform.pollution.offsetX;
        }
      }

      for (const droplet of this.droplets) {
        droplet.x = clamp(droplet.x, this.levelPadding, this.worldWidth - this.levelPadding);
      }

      this.player.x = clamp(this.player.x, this.levelPadding, this.worldWidth - this.player.width - this.levelPadding);
      this.checkpoint.x = clamp(
        this.checkpoint.x,
        this.levelPadding,
        this.worldWidth - this.player.width - this.levelPadding
      );
    }

    generateInitialLevel() {
      const startingPlatformWidth = this.getPlatformWidth({ isStartingPlatform: true });
      const startingPlatform = {
        x: (this.worldWidth - startingPlatformWidth) / 2,
        y: this.startingY,
        width: startingPlatformWidth,
        height: clamp(18 * this.ledgeScale, 14, 22),
        hue: 184,
        moving: false,
        isStartingPlatform: true,
        widthFactor: 0.5
      };
      this.platforms.push(startingPlatform);
      this.checkpointPlatform = { ...startingPlatform };
      this.checkpoint = {
        x: startingPlatform.x + startingPlatform.width / 2 - this.player.width / 2,
        y: startingPlatform.y - this.player.height
      };
      this.player.x = this.checkpoint.x;
      this.player.y = this.checkpoint.y;
      this.highestGenerated = this.startingY;

      for (let platformY = this.startingY - TUNE.platformGap; platformY > -2600; platformY -= TUNE.platformGap) {
        this.addPlatformTier(platformY);
      }

      const starterDrops = [
        { x: startingPlatform.x + startingPlatform.width * 0.31, y: this.startingY - 45 },
        { x: startingPlatform.x + startingPlatform.width * 0.77, y: this.startingY - 140 },
        { x: startingPlatform.x + startingPlatform.width * 0.08, y: this.startingY - 235 }
      ];
      this.droplets.push(...starterDrops.map((point) => ({
        ...point,
        taken: false,
        phase: randomBetween(0, 7)
      })));
    }

    addPlatformTier(platformY) {
      const difficulty = clamp((this.startingY - platformY) / 1700, 0, 1);
      const widthFactor = Math.random();
      const platformWidth = this.getPlatformWidth({ difficulty, variation: widthFactor });
      const previousPlatform = this.platforms[this.platforms.length - 1];
      const maximumHorizontalShift = this.isNarrowViewport
        ? clamp(this.viewWidth * 0.26, 70, 180)
        : 260;
      const platformX = clamp(
        previousPlatform.x + randomBetween(-maximumHorizontalShift, maximumHorizontalShift),
        this.levelPadding,
        this.worldWidth - platformWidth - this.levelPadding
      );
      const platform = {
        x: platformX,
        baseX: platformX,
        y: platformY,
        width: platformWidth,
        widthFactor,
        height: clamp(16 * this.ledgeScale, 12, 20),
        hue: 182 + randomBetween(-18, 22),
        moving: Math.random() < 0.1 + difficulty * 0.12,
        phase: randomBetween(0, 7),
        range: randomBetween(35, 90)
      };

      this.platforms.push(platform);

      if (Math.random() < TUNE.dropletSpawnChance) {
        const dropCount = Math.random() < TUNE.extraDropletChance ? 2 : 1;
        for (let dropIndex = 0; dropIndex < dropCount; dropIndex += 1) {
          this.droplets.push({
            x: platformX + platformWidth * (dropIndex + 1) / (dropCount + 1),
            y: platformY - randomBetween(24, 46),
            taken: false,
            phase: randomBetween(0, 7)
          });
        }
      }

      if (Math.random() < 0.16) {
        platform.station = true;
      }

      if (!platform.station && Math.random() < 0.22) {
        const pollutionWidth = 24;
        platform.pollution = {
          x: platformX + randomBetween(16, platformWidth - pollutionWidth - 16),
          y: platformY - 13,
          width: pollutionWidth,
          height: 13,
          offsetX: 0,
          cleared: false
        };
        platform.pollution.offsetX = platform.pollution.x - platformX;
      }
    }

    generateMorePlatforms() {
      while (this.highestGenerated > this.player.y - TUNE.generationAhead) {
        this.highestGenerated -= TUNE.platformGap;
        this.addPlatformTier(this.highestGenerated);
      }
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('keydown', (event) => this.handleKeyDown(event));
      window.addEventListener('keyup', (event) => keys.delete(event.key));

      document.getElementById('startButton').onclick = () => {
        this.sound.init();
        this.state = 'playing';
        ui.startScreen.classList.add('is-hidden');
      };
      document.getElementById('resumeButton').onclick = () => this.togglePause();
      document.getElementById('continueButton').onclick = () => {
        this.state = 'playing';
        ui.winScreen.classList.add('is-hidden');
      };
      document.getElementById('respawnButton').onclick = () => this.respawn();
      document.getElementById('pauseButton').onclick = () => this.togglePause();
      document.getElementById('resetButton').onclick = () => this.resetGame();
      document.getElementById('muteButton').onclick = (event) => {
        this.sound.muted = !this.sound.muted;
        event.currentTarget.textContent = this.sound.muted ? '×' : '♫';
      };

      this.bindTouchButton('leftTouch', 'ArrowLeft');
      this.bindTouchButton('rightTouch', 'ArrowRight');
      this.bindTouchButton('jumpTouch', ' ');
      document.getElementById('bankTouch').addEventListener('pointerdown', () => this.bank());
    }

    handleKeyDown(event) {
      const preventDefaultKeys = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (preventDefaultKeys.includes(event.key)) {
        event.preventDefault();
      }

      keys.add(event.key);

      if (event.key.toLowerCase() === 'p') {
        this.togglePause();
      }
      if (event.key.toLowerCase() === 's' || event.key === 'ArrowDown') {
        this.bank();
      }
    }

    bindTouchButton(elementId, key) {
      const button = document.getElementById(elementId);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        keys.add(key);
      });
      button.addEventListener('pointerup', () => keys.delete(key));
      button.addEventListener('pointerleave', () => keys.delete(key));
      button.addEventListener('pointercancel', () => keys.delete(key));
    }

    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        ui.pauseScreen.classList.remove('is-hidden');
      } else if (this.state === 'paused') {
        this.state = 'playing';
        ui.pauseScreen.classList.add('is-hidden');
      }
    }

    bank() {
      if (this.state !== 'playing') {
        return;
      }

      const station = this.platforms.find((platform) => {
        const nearHeight = Math.abs(this.player.y + this.player.height - platform.y) < 54;
        const nearCenter = Math.abs(this.player.x + this.player.width / 2 - (platform.x + platform.width / 2)) < platform.width / 2 + 44;
        return platform.station && nearHeight && nearCenter;
      });

      if (!station || !this.unbanked) {
        return;
      }

      const amount = this.unbanked;
      this.stored += amount;
      this.score += amount * 10 + (amount >= 5 ? 25 : 0);
      this.unbanked = 0;
      this.checkpoint = {
        x: station.x + station.width / 2 - this.player.width / 2,
        y: station.y - this.player.height
      };
      this.checkpointPlatform = { ...station };

      this.sound.beep(620, 0.16, 'sine');
      this.message(`BANKED +${amount} / SAFE`, COLORS.player);
      this.createParticles(this.player.x + this.player.width / 2, station.y, COLORS.player, 18, 180);
    }

    collectDroplets() {
      for (const droplet of this.droplets) {
        if (droplet.taken) {
          continue;
        }

        const distanceX = this.player.x + this.player.width / 2 - droplet.x;
        const distanceY = this.player.y + this.player.height / 2 - droplet.y;
        if (distanceX * distanceX + distanceY * distanceY >= 650) {
          continue;
        }

        droplet.taken = true;
        this.unbanked += 1;
        this.score += 2;
        this.sound.beep(560 + this.unbanked * 4, 0.055, 'sine');
        this.message('+1 DROP');
        this.createParticles(droplet.x, droplet.y, COLORS.particle, 6, 90);
      }
    }

    handlePollution() {
      for (const platform of this.platforms) {
        const pollution = platform.pollution;
        if (!pollution || pollution.cleared) {
          continue;
        }

        const overlaps = this.player.x < pollution.x + pollution.width
          && this.player.x + this.player.width > pollution.x
          && this.player.y < pollution.y + pollution.height
          && this.player.y + this.player.height > pollution.y;
        if (!overlaps) {
          continue;
        }

        pollution.cleared = true;
        if (this.unbanked > 0) {
          this.unbanked -= 1;
          this.message('-1 DROP', COLORS.pollutionHighlight);
        } else {
          this.message('POLLUTION', COLORS.pollutionHighlight);
        }
        this.sound.beep(120, 0.1, 'square');
        this.createParticles(pollution.x + pollution.width / 2, pollution.y, COLORS.pollutionHighlight, 8, 75);
      }
    }

    createParticles(x, y, color, count, speed) {
      for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
        this.particles.push(new Particle(x, y, color, speed));
      }
    }

    respawn() {
      this.state = 'playing';
      ui.fallScreen.classList.add('is-hidden');
      this.unbanked = 0;
      this.restoreCheckpointPlatform();
      this.player.x = this.checkpoint.x;
      this.player.y = this.checkpoint.y;
      this.player.velocityX = 0;
      this.player.velocityY = 0;
      this.camera.y = this.player.y - this.viewHeight * 0.63;
    }

    fall() {
      this.state = 'fallen';
      ui.fallScreen.classList.remove('is-hidden');
      this.unbanked = 0;
      this.sound.beep(90, 0.25, 'sawtooth');
    }

    restoreCheckpointPlatform() {
      if (!this.checkpointPlatform) {
        return;
      }

      const platformExists = this.platforms.some((platform) => (
        platform.x === this.checkpointPlatform.x
        && platform.y === this.checkpointPlatform.y
        && platform.width === this.checkpointPlatform.width
      ));

      if (!platformExists) {
        this.platforms.unshift({ ...this.checkpointPlatform });
      }
    }

    message(text, color = COLORS.accent) {
      const messageElement = document.createElement('div');
      messageElement.className = 'float-message';
      messageElement.textContent = text;
      messageElement.style.color = color;
      ui.messageStack.appendChild(messageElement);
      setTimeout(() => messageElement.remove(), 1400);
    }

    update(deltaTime) {
      this.time += deltaTime;
      this.updateMovingPlatforms();
      this.player.update(this, deltaTime);
      this.collectDroplets();
      this.handlePollution();
      this.generateMorePlatforms();
      this.updateHeightAndScore();
      this.updateCamera(deltaTime);
      this.removeOutOfViewPlatforms();
      this.updateParticles(deltaTime);
      this.checkWinCondition();

      if (this.player.y - this.camera.y > this.viewHeight + TUNE.fallLimit) {
        this.fall();
      }
    }

    updateMovingPlatforms() {
      for (const platform of this.platforms) {
        if (platform.moving) {
          platform.x = clamp(
            platform.baseX + Math.sin(this.time * 0.8 + platform.phase) * platform.range,
            this.levelPadding,
            this.worldWidth - platform.width - this.levelPadding
          );
        }
        if (platform.pollution) {
          platform.pollution.x = platform.x + platform.pollution.offsetX;
        }
      }
    }

    removeOutOfViewPlatforms() {
      const lowestVisibleY = this.camera.y + this.viewHeight;
      this.platforms = this.platforms.filter((platform) => platform.y <= lowestVisibleY);
      this.droplets = this.droplets.filter((droplet) => !droplet.taken && droplet.y <= lowestVisibleY);
    }

    updateHeightAndScore() {
      const height = Math.max(0, Math.floor((this.startingY - this.player.y) / 5));
      if (height <= this.maxHeight) {
        return;
      }

      if (height > 0 && height % 100 === 0) {
        this.score += 50;
        this.message(`ALTITUDE ${height}m +50`, COLORS.accent);
        this.sound.beep(800, 0.12, 'triangle');
      }
      this.maxHeight = height;
    }

    checkWinCondition() {
      if (this.winShown || this.score < 750) {
        return;
      }

      this.winShown = true;
      this.state = 'won';
      ui.winScreen.classList.remove('is-hidden');
      this.sound.beep(740, 0.14, 'sine');
    }

    updateCamera(deltaTime) {
      const targetY = this.player.y - this.viewHeight * 0.62;
      this.camera.y += (targetY - this.camera.y) * Math.min(1, deltaTime * 5);
      this.camera.x = (this.worldWidth - this.viewWidth) / 2;
    }

    updateParticles(deltaTime) {
      for (const particle of this.particles) {
        particle.update(deltaTime);
      }
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    drawBackground() {
      const altitude = clamp(this.maxHeight / 1800, 0, 1);
      const gradient = context.createLinearGradient(0, 0, 0, this.viewHeight);
      const topColor = altitude > 0.65 ? '#070f2a' : altitude > 0.3 ? '#102b5a' : '#3180a2';
      const bottomColor = altitude > 0.65 ? '#18244c' : '#0a3157';

      gradient.addColorStop(0, topColor);
      gradient.addColorStop(1, bottomColor);
      context.fillStyle = gradient;
      context.fillRect(0, 0, this.viewWidth, this.viewHeight);

      context.globalAlpha = 0.15;
      for (let cloudIndex = 0; cloudIndex < 22; cloudIndex += 1) {
        const cloudX = (cloudIndex * 173 + this.camera.y * (cloudIndex % 3 + 1) * 0.015) % (this.viewWidth + 200) - 100;
        const cloudY = (cloudIndex * 97 + this.camera.y * 0.08) % (this.viewHeight + 120);

        context.fillStyle = '#b8eff0';
        context.beginPath();
        context.ellipse(cloudX, cloudY, 90 + cloudIndex % 4 * 30, 18, 0, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      if (altitude > 0.55) {
        context.fillStyle = '#d9edff';
        context.globalAlpha = 0.8;
        context.beginPath();
        context.arc(this.viewWidth - 100, 120, 36, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#10234a';
        context.beginPath();
        context.arc(this.viewWidth - 85, 108, 36, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    }

    drawPlatforms() {
      context.save();
      context.translate(-this.camera.x, -this.camera.y);

      for (const platform of this.platforms) {
        const outsideViewport = platform.y < this.camera.y - 40 || platform.y > this.camera.y + this.viewHeight + 40;
        if (outsideViewport) {
          continue;
        }

        context.fillStyle = `hsl(${platform.hue}, 48%, 39%)`;
        context.fillRect(platform.x, platform.y, platform.width, platform.height);
        context.fillStyle = COLORS.platformTop;
        context.fillRect(platform.x, platform.y, platform.width, 4);

        if (platform.station) {
          const tankX = platform.x + platform.width / 2 - 19;
          const tankY = platform.y - 29;

          context.fillStyle = COLORS.station;
          context.fillRect(tankX, tankY + 5, 38, 24);
          context.beginPath();
          context.arc(platform.x + platform.width / 2, tankY + 5, 19, Math.PI, 0);
          context.fill();
          context.fillStyle = COLORS.tankWater;
          context.fillRect(tankX + 4, tankY + 16, 30, 9);
          context.fillStyle = COLORS.stationOpening;
          context.fillRect(tankX + 12, tankY, 14, 6);
          context.strokeStyle = COLORS.stationOpening;
          context.lineWidth = 2;
          context.strokeRect(tankX, tankY + 5, 38, 24);

          context.fillStyle = COLORS.playerHighlight;
          context.beginPath();
          context.moveTo(platform.x + platform.width / 2, tankY + 9);
          context.quadraticCurveTo(platform.x + platform.width / 2 + 5, tankY + 15, platform.x + platform.width / 2, tankY + 19);
          context.quadraticCurveTo(platform.x + platform.width / 2 - 5, tankY + 15, platform.x + platform.width / 2, tankY + 9);
          context.fill();
        }

        const pollution = platform.pollution;
        if (pollution && !pollution.cleared) {
          const trashX = pollution.x;
          const trashY = pollution.y;

          context.fillStyle = COLORS.pollution;
          context.fillRect(trashX + 3, trashY + 3, pollution.width - 6, pollution.height);
          context.fillStyle = COLORS.pollutionHighlight;
          context.fillRect(trashX, trashY, pollution.width, 4);
          context.fillRect(trashX + 8, trashY - 4, 8, 4);
          context.strokeStyle = COLORS.pollutionHighlight;
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(trashX + 8, trashY + 7);
          context.lineTo(trashX + 8, trashY + 12);
          context.moveTo(trashX + 16, trashY + 7);
          context.lineTo(trashX + 16, trashY + 12);
          context.stroke();

          context.fillStyle = COLORS.pollutionWarning;
          context.beginPath();
          context.arc(trashX + pollution.width + 5, trashY - 2, 7, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = COLORS.stationOpening;
          context.font = 'bold 10px sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText('!', trashX + pollution.width + 5, trashY - 2);
        }
      }

      context.restore();
    }

    drawDroplets() {
      for (const droplet of this.droplets) {
        const outsideViewport = droplet.y < this.camera.y - 30 || droplet.y > this.camera.y + this.viewHeight + 30;
        if (droplet.taken || outsideViewport) {
          continue;
        }

        const screenX = droplet.x - this.camera.x;
        const screenY = droplet.y - this.camera.y + Math.sin(this.time * 3 + droplet.phase) * 4;

        context.fillStyle = COLORS.particle;
        context.beginPath();
        context.moveTo(screenX, screenY - 9);
        context.quadraticCurveTo(screenX + 9, screenY + 3, screenX, screenY + 10);
        context.quadraticCurveTo(screenX - 9, screenY + 3, screenX, screenY - 9);
        context.fill();
      }
    }

    draw() {
      this.drawBackground();
      this.drawPlatforms();
      this.drawDroplets();
      this.player.draw(this.camera);

      for (const particle of this.particles) {
        particle.draw(this.camera);
      }
    }

    updateUi() {
      ui.storedValue.textContent = this.stored;
      ui.unbankedValue.textContent = this.unbanked;
      ui.heightValue.textContent = this.maxHeight;
      ui.scoreValue.textContent = this.score;
    }

    loop(time) {
      const deltaTime = Math.min(TUNE.maxDt, (time - this.lastTime) / 1000 || 0);
      this.lastTime = time;

      if (this.state === 'playing') {
        this.update(deltaTime);
      }

      this.draw();
      this.updateUi();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }
  }

  new Game();
})();
