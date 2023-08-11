/**
 * This is the core Bingo App WebComponent, used to create the game, register the client and provide the UI.
 *
 * Although this is one client, there are two distinct functions going on here:
 * 1. Some methods are used by players, during gameplay. These have a this.party.role of 'player'
 * 2. A small subset of methods are used only by the host. These have a this.party.role of 'host'
 *
 * The general rule of thumb is that commands that change the state of the game, ie, start, stop, join, etc
 * should only come from the host, and we treat the host as the Single Source of Truth for the gameplay.
 *
 * @todo - as a general requirement, we should do some sort of signing to ensure that host messages are
 *      coming from a legitimate host. Currently, anyone could intercept a host message and modify it. We
 *      asume they wouldn't do this right now, because that would be lame.
 *
 * @class BingoApp
 * @typedef {BingoApp}
 * @extends {window.HTMLElement}
 */
class BingoApp extends window.HTMLElement {
  /**
   * Creates an instance of BingoApp, and sets up some initial properties.
   *
   * The constructor process is essentially:
   * 1. Connect to relay, UI and collect up UI elements ready for use
   * 2. Request for the host to identify themselves
   * 3.1. If the host is identified, request to join the game
   * 3.2. If no host comes forward, assume host role and prep for more players to join
   * 4. Wait for > 2 players
   * 5. Start the game!
   *
   * @constructor
   */
  constructor () {
    super()

    // Currently the room ID is static, meaning everyone will join the same room when they visit the page.
    // This could, instead, be dynamic, and allow users to share and enter a unqiue Room ID to create multiple
    // simultaneous games in different rooms.
    this.room = 'vcbnhmweibcwe83732'

    // Because both the app and the e2e tests run in the browser, we detect test mode and change the room to
    // a private one to ensure tests aren't confused.
    if (typeof window.TEST_MODE !== 'undefined' && window.TEST_MODE === true) {
      this.room = 'kithnbftyudtghjenb73678'
    }

    console.log(this.room)

    // Instantiate our relay class, used for communicating with other players.
    this.relay = new Relay(this.room)

    this.relay.responseHandler = this

    this.elements = {
      status: this.querySelector('#status'),
      players: this.querySelector('#players'),
      called: this.querySelector('#called'),
      next: this.querySelector('#next'),
      startButton: this.querySelector('#start'),
      resetButton: this.querySelector('#reset'),
      claimButton: this.querySelector('#claim'),
      gamecard: this.querySelector('#gamecard')
    }

    // Create our 'party' object which is separate from a game. A party is a group of players that may play one
    // or more games. Think of this sort of like a lobby.
    this.party = {
      host: null,
      role: 'player', // A player may be promoted to host if they are the first in the room
      players: []
    }

    // We set a flag to say 'we're waiting to join a game' - used in commandHostIdentified, when a host comes forwards.
    this.waitingToJoin = true

    // Listen for UI events and messages from the relay
    this.registerEvents()

    // Set up our game, ready to start
    this.setInitialState()

    // Request the host to identify themselves
    this.getCurrentHost()

    // Wait 5-8 seconds for a host to come forwards, otherwise, assume host ourselves.
    // We use a random timeout here to avoid race condition on two players entering the page at the exact same time
    // however unlikely. This timeout is canelled if a host comes forwards within the timeout period.
    this.hostWaitTimeout = setTimeout(() => {
      this.possiblyAssumeHost()
    }, this.generateRandomNumber(5000, 8000))

    // Start an interval to prepare for the game to start.
    this.getReadyInterval = setInterval(() => this.getReady(), 1000)
  }

  /**
   * Sets the initial gameplay state, which is waiting for others to join.
   */
  setInitialState () {
    this.elements.status.innerText = 'Waiting to join...'
    this.elements.called.innerText = ''
    this.elements.next.innerText = ''
    this.elements.startButton.disabled = true
    this.elements.resetButton.disabled = true
    this.elements.claimButton.disabled = true

    this.game = {
      status: 'joining',
      card: [],
      called: [],
      disqualified: []
    }
  }

  /**
   * Create a series of ongoing event listeners for UI actions
   */
  registerEvents () {
    // We listen for CustomEvents (which are the equivalent of messages) from the relay and we pass these
    // to the handler. We use CustomEvents to decouple our UI from our messaging logic.
    this.addEventListener('command', (event) => { this.handleCommand(event.detail) })

    // Listen for interactions with our UI elements (some of which are only available to hosts)
    this.elements.startButton.addEventListener('click', (event) => { this.startGame() }) // Host-only function
    this.elements.resetButton.addEventListener('click', (event) => { this.resetGame() }) // Host-only function
    this.elements.claimButton.addEventListener('click', (event) => { this.lodgeClaim() }) // All players function

    // We listen to beforeUnload to notify everyone that a player has left.
    window.addEventListener('beforeunload', (event) => { console.log('beforeunload'); this.leaveGame() })
  }

  /**
   * The handleCommand function is called whenever a message / command is received from our relay.
   *
   * @param {Object} command
   * @param {string} command.command - this is the specific command being sent, for example 'join' or 'start'
   */
  handleCommand (command) {
    console.log('command', command)
    switch (command.command) {
      case 'hostidentify': // A user is requesting the host to idenfity themselves
        this.commandHostIdentify()
        break
      case 'iamhost': // A host has responded to the 'hostidentify' request
        this.commandHostIdentified(command)
        break
      case 'join': // A player is requesting to join the game
        this.commandJoinGame(command)
        break
      case 'joined': // The host has allowed a player to join the game
        this.commandJoinedGame(command)
        break
      case 'hold': // The host has told a player requesting to join to wait until the current game is over
        this.commandHold()
        break
      case 'leave': // A player has left the game
        this.commandLeaveGame(command)
        break
      case 'players': // The host has sent an updated list of players to clients
        this.commandUpdatePlayers(command)
        break
      case 'start': // The host has started the game
        this.commandStartGame()
        break
      case 'reset': // The host has instructed clients to reset, ready for the next game
        this.commandResetGame()
        break
      case 'call': // The host has called the next bingo number
        this.commandCall(command)
        break
      case 'claim': // A player has told the host that they think they have bingo!
        this.commandClaim(command)
        break
      case 'claimmade': // The host has recieved the claim and is now verifying it, the game is paused.
        this.commandClaimMade(command)
        break
      case 'claimvalid': // The host has validated the claim, and it's legit, a player has won!
        this.commandClaimValid(command)
        break
      case 'claiminvalid': // The host has validated the claim, and it's a mistake - d'oh, the game goes on.
        this.commandClaimInvalid(command)
        break
    }
  }

  /**
   * Generates a sequence of unique random integers between {min} and {max}
   *
   * @param {number} [min=1] - minimum number to generate (inclusive)
   * @param {number} [max=90] - maximum number to generate (inclusive)
   * @param {number} [length=25] - length of array to generate
   * @returns {Array} an array of {length} of random numbers between {min} and {max}
   */
  generateRandomNumbers (min = 1, max = 90, length = 25) {
    const numbers = []
    while (numbers.length < length) {
      const r = this.generateRandomNumber(min, max)
      // We do an additional check here to ensure that the generated number is not already in the array
      if (numbers.indexOf(r) === -1) numbers.push(r)
    }
    return numbers
  }

  /**
   * Pseudo-random number generator used to generate bingo cards and call bingo numbers
   *
   * @param {number} [min=1] - minimum number to generate (inclusive)
   * @param {number} [max=90] - maximum number to generate (inclusive)
   * @returns {number} an integer between {min} and {max}
   */
  generateRandomNumber (min = 1, max = 90) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * Generates a single pseudo-random number between {min} and {max} that doesn't already exist in {array}
   *
   * @param {number} [min=1] - minimum number to generate (inclusive)
   * @param {number} [max=90] - maximum number to generate (inclusive)
   * @param {Array} array - the array to check against, if a number is already in this, it won't be generated
   * @returns {number} - an integer between {min} and {max} that isn't in {array}
   */
  generateRandomNumberNotAlreadyCalled (min = 1, max = 90, array) {
    let number = false
    while (!number) {
      const r = this.generateRandomNumber(min, max)
      if (array.indexOf(r) === -1) number = r
    }
    return number
  }

  /**
   * Request for a host to come forward and identify themselves with the 'iamhost' command.
   * We allow between 5-8 seconds for a response before we promote ourselves to host.
   */
  getCurrentHost () {
    this.relay.getGameHost()
  }

  /**
   * Used by the host and clients to update their player list in the client.
   *
   * @param {string} playerId - the clientID of the player to be added to the list
   */
  addPlayer (playerId) {
    this.party.players.push(playerId)
    // Update the UI
    this.updatePlayerList()
  }

  /**
   * Used by the host and clients to update their player list in the client, after a player is removed
   *
   * @param {*} playerId
   */
  removePlayer (playerId) {
    this.party.players = this.party.players.filter((player) => player !== playerId)
    // Update the UI
    this.updatePlayerList()
  }

  /**
   * After the 5-8 second timeout, if a host hasn't come forward, we assume the host role, if there are no other players.
   */
  possiblyAssumeHost () {
    if (this.party.players.length < 1) {
      this.becomeHost()
    }
  }

  /**
   * If there's no other host, we'll become it. Sets our internal role to host and broadcasts this to the rest of the
   * clients, using the 'iamhost' command. Finally, add ourselves to the player list.
   */
  becomeHost () {
    this.party.role = 'host'
    this.party.host = this.relay.clientID
    this.role = 'host'
    this.relay.identifyAsHost()
    this.waitingToJoin = false
    this.addPlayer(this.relay.clientID)
  }

  /**
   * Request to join a game. This request might be denied if the game is in progress, in which case, we'll get a
   * 'hold' command
   */
  tryToJoinGame () {
    this.relay.joinGame()
    this.elements.status.innerText = 'Trying to join game...'
  }

  /**
   * Called from 'onBeforeUnload', just before they leave the page, notify all connected clients that this player has
   * left the game.
   */
  leaveGame () {
    this.relay.leaveGame()
  }

  /**
   * A primarily-host function that checks every second to ensure that there are two or more players. When there are,
   * enable the start button, and stop further checking.
   */
  getReady () {
    this.elements.status.innerText = 'Waiting for players...'
    if (this.party.role === 'host' && this.game.status !== 'playing' && this.party.players.length > 1) {
      this.elements.status.innerText = 'Ready to start'
      this.elements.startButton.disabled = false
      // @todo - this clearInterval should be done at game start, rather than now, so that if a player drops out,
      // the button is set back to disabled, and we have to wait for another player to join again.
      clearInterval(this.getReadyInterval)
    }
  }

  /**
   * Called after a player is added or removed, or after the host issues a player list update. Renders the player list to
   * the UI, using a cute little seeded gravatar-style API.
   */
  updatePlayerList () {
    this.elements.players.innerHTML = this.party.players.map((player) =>
      `<div class="player ${player === this.relay.clientID ? 'you ' : ''} ${player === this.party.host ? 'host' : ''}"><img src="https://api.dicebear.com/6.x/thumbs/svg?seed=${player}" />${player}</div>`
    ).join('')
  }

  /**
   * Host-only
   *
   * Triggered by clicking the 'start' button. Sends the 'game is starting' command to all connected clients
   */
  startGame () {
    if (this.party.role === 'host') {
      this.relay.startGame()
    }
  }

  /**
   * Host-only
   *
   * Triggered by clicking the 'reset' button. Sends the 'reset yourself' command to all connected clients,
   * in preparation of the next game.
   */
  resetGame () {
    if (this.party.role === 'host') {
      this.relay.resetGame()
    }
  }

  /**
   * Once the game starts, enable the 'BINGO!' button.
   */
  enableClaimButton () {
    this.elements.claimButton.disabled = false
  }

  /**
   * Triggered by a click on the Bingo! button. Sends a message to the host that registers a claim, and sends
   * their game card to the host for verifying. I know we could do verification client-side, but I don't trust anyone.
   */
  lodgeClaim () {
    this.elements.claimButton.disabled = true
    this.relay.claim(this.game.card)
  }

  /**
   * Host-only
   *
   * When a claim is lodged, the host will validate the card. We break the card by rows and columns (no diagonals)
   * and we run these rows and columns in a loop against the called numbers. If every number in any of the rows or
   * columns also appear in the called numbers array, they have won. If any numbers are missing, they do not.
   *
   * @param {Array} gamecard - an array of 25 integers, which is the gamecard of the player claiming they have won
   * @returns {boolean} - true if the card is a winner, false if not.
   */
  verifyClaim (gamecard) {
    // Break our gamecard into rows of 5 numbers
    const rows = []
    for (let i = 0; i < gamecard.length; i += 5) {
      rows.push(gamecard.slice(i, i + 5))
    }

    // Break our gamecard into columns of 5 by creating an empty array of 5, and using the keys in a modulii comparison
    // against the gamecard numbers as a filter. Essentially, we create a multidimensional array based on the keys, and
    // afterwards, we no longer care about the original keys.
    const columns = [...Array(5).keys()].map(column => gamecard.filter((_, i) => i % 5 === column))

    // Merge the rows and columns (because we don't really care if it's a row or column, just that it's a winner, baby!)
    const cardRowsAndCols = rows.concat(columns)

    // Now iterate through and check each row and column to see if every number in there is also in the game.called array
    let claimValid = false
    for (let i = 0; i < cardRowsAndCols.length; i++) {
      if (cardRowsAndCols[i].every(number => this.game.called.includes(number))) {
        claimValid = true
      }
    }

    // And spit out the result.
    return claimValid
  }

  /**
   * When a game begins, we need to generate a bingo card for the player. This is a 25 length array of integers between
   * 1 and 90. Then display this on the UI (which uses CSS to break this into 5x5 grid.)
   */
  generateGameCard () {
    this.game.card = this.generateRandomNumbers() // Default params are min = 1, max = 90, length = 25
    this.updateGameCardDisplay()
  }

  /**
   * Output the generated bingo card numbers to screen, so the user can see them. Each time this is called, it'll fully
   * re-render the card to screen.
   *
   * This method is also called when a new number is called, and matching numbers from the called array are marked with
   * a special class for formatting.
   */
  updateGameCardDisplay () {
    this.elements.gamecard.innerHTML = this.game.card.map((number) =>
      `<span class="${this.game.called.includes(number) ? 'called' : ''}">${number}</span>`
    ).join('')
  }

  /**
   * When a new number is called, we also show all previous numbers. Each time a number is called,
   * we update the UI with the new list (which is sent by the host to avoid tampering)
   */
  updateCalledDisplay () {
    this.elements.called.innerHTML = this.game.called.map((number) =>
      `<span>${number}</span>`
    ).join('')
  }

  /**
   * Host Only
   *
   * When a game begins, the host starts calling numbers, equivalent to sticking their hand in the spinning
   * barrel and pulling a number. We call a new number every 5 seconds, until someone claims bingo, at which
   * point we pause and verify the claim.
   */
  startCalling () {
    this.callingInterval = setInterval(() => {
      // Pull a number that doesn't already exist
      const number = this.generateRandomNumberNotAlreadyCalled(1, 90, this.game.called)
      // Store it locally
      this.game.called.push(number)
      // Send it to everyone
      this.relay.callNumber(number, this.game.called)
      // If we've called all numbers without a winner, someone has fallen asleep.
      // We pause to avoid a memory leak in the while() call.
      if (this.game.called.length === 90) {
        this.pauseCalling()
      }
    }, 5000)
  }

  /**
   * Host Only
   *
   * Cancels the calling loop. Simple. Done when a claim is made, and is being verified.
   */
  pauseCalling () {
    clearInterval(this.callingInterval)
  }

  /**
   * Host Only
   *
   * Someone is requesting the host to identify themselves. If I am the host, I will reply.
   * Ignored by everyone else.
   */
  commandHostIdentify () {
    if (this.party.role === 'host') {
      this.relay.identifyAsHost()
    }
  }

  /**
   * When a host steps forward and identifies themselves, we no longer need to worry about
   * whether we need to promote ourselves to host. So cancel that check, and instead, request to
   * join the game.
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.clientID - the ClientID of the player identifying themselves as host
   */
  commandHostIdentified (command) {
    this.party.host = command.clientID
    clearTimeout(this.hostWaitTimeout)
    if (this.waitingToJoin) {
      this.tryToJoinGame()
    }
  }

  /**
   * Host Only
   *
   * Someone has sent a join request. If we are the host, we should respond. If the game is currently
   * open, and not in play, we should allow them to join, add them to player list, then send a broadcast
   * to all connected clients that this ClientID has joined, and subsequently send a full player list
   * update to ensure everyone is in sync.
   *
   * If the game is in play, send a message back saying 'hold' which will cause that client to try to
   * connect to the game every 5 seconds (see @{commandHold}).
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.clientID - the ClientID of the player wishing to join
   */
  commandJoinGame (command) {
    if (this.party.role === 'host') {
      if (this.game.status === 'joining') {
        this.addPlayer(command.clientID)
        this.relay.joined(command.clientID)
        this.relay.broadcastPlayers(this.party.players)
      } else {
        this.relay.hold()
      }
    }
  }

  /**
   * Client-only - restricted to the player requesting to join.
   *
   * If the host permits entry to the game, they'll return a 'joined' response, along with the clientID
   * of the client that joined. We check here if this is our client ID, and if so, we cancel the timeout
   * to request to join again, because we're already in.
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.clientID - the ClientID of the player requesting to join
   */
  commandJoinedGame (command) {
    // Check if this message was addressed to us
    if (command.clientID === this.relay.clientID) {
      this.waitingToJoin = false
      clearTimeout(this.gameWaitingTimeout)
    }
  }

  /**
   * Client-only
   *
   * When requesting to join a game that's already in play, the host might return 'hold' which means we need
   * to wait until the game finishes to join. Wait for 5 seconds and request to join again. Continue this until
   * we're allowed in.
   */
  commandHold () {
    if (this.waitingToJoin) {
      this.elements.status.innerText = 'Waiting for next game to start...'
      clearTimeout(this.gameWaitingTimeout)
      this.gameWaitingTimeout = setTimeout(() => {
        this.tryToJoinGame()
      }, 5000)
    }
  }

  /**
   * Host only
   *
   * If a player closes their browser window or navigates away, we should remove them from the players list and
   * send an updated players list to all connected clients.
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.clientID - the ClientID of the player leaving the game
   */
  commandLeaveGame (command) {
    if (this.party.role === 'host') {
      this.removePlayer(command.clientID)
      this.relay.broadcastPlayers(this.party.players)
    }
  }

  /**
   * This is a command that the game is starting! So a couple of changes to the UI to let the user know this,
   * enable the 'BINGO' button and generate a game card for the user.
   *
   * If I'm the host, start the calling cycle loop to pull a number every 5 seconds.
   *
   */
  commandStartGame () {
    clearInterval(this.getReadyInterval)
    this.game.status = 'playing'
    this.elements.status.innerText = 'Game is starting...'
    setTimeout(() => {
      this.elements.status.innerText = '';
    }, 5000)
    this.classList.add('started')
    this.enableClaimButton()
    this.generateGameCard()
    if (this.party.role === 'host') {
      this.startCalling()
    }
  }

  /**
   * When the host hits the 'reset' button, this command is sent to all clients to tell them to prepare for the next
   * game. Action this by resetting classes, resetting state back to the default (which also clears disqualifications,
   * called numbers, etc) and loop the 'getReady' cycle for the next game.
   */
  commandResetGame () {
    this.classList.remove('finished')
    this.setInitialState()
    this.getReadyInterval = setInterval(() => this.getReady(), 1000)
  }

  /**
   * The host has pulled a number.
   *
   * If we're not the host, we should add this to the list of called numbers.
   *
   * Then everyone (including the host) should update the list of called numbers, and also display the newly-called number
   * on the big blue shiny ball. We should also mark the number off on our bingo card if it's on there.
   *
   * @param {*} command
   */
  commandCall (command) {
    if (this.party.role !== 'host') { // The host has already done this action, prior to this call.
      this.game.called.push(command.number)
    }
    this.updateCalledDisplay() // Update the UI list of already called numbers
    this.elements.next.innerText = command.number // Show the number on the shiny ball
    this.updateGameCardDisplay() // Mark the number off on our card if we have it.
  }

  /**
   * Host only
   *
   * When a player claims bingo, it's broadcast using this function, only the host takes action.
   * If the player isn't disqualified, we send a broadcast to all connected clients letting them
   * know a claim is in, and we verify the gamecard.
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.claimer - the ClientID of the player claiming to have won the game
   * @param {Array} command.gamecard - the gamecard of the player claiming to have won the game - 25 length array of integers
   */
  commandClaim (command) {
    // Check if the player is in the naughty bin, if they are, we silently ignore this request.
    if (this.party.role === 'host' && !this.game.disqualified.includes(command.claimer)) {
      // Stop calling numbers
      this.pauseCalling()
      // Send a notifcation that the claim is in to everyone/
      this.relay.claimMade(command.claimer)
      // Run the gamecard through verification
      if (this.verifyClaim(command.gamecard)) {
        // It's invalid, pause for dramatic effect
        setTimeout(() => {
          // Notify everyone that's it's valid, game over.
          this.relay.claimValid(command.claimer)
        }, this.generateRandomNumber(4, 8) * 1000)
      } else {
        // it's invalid, pause for dramatic effect
        setTimeout(() => {
          // Add they player to the disqualified list
          this.game.disqualified.push(command.claimer)
          // Let everyone know that the claim wasn't legit
          this.relay.claimInvalid(command.claimer)
          // Start the game again, until the next claim.
          this.startCalling()
        }, this.generateRandomNumber(3, 6) * 1000)
      }
    }
  }

  /**
   * Once a host has recieved a claim and made sure that person isn't disqualified, they'll notify all
   * clients that a claim is in. Here, we update the UI with messaging to reflect that.
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.claimer - the ClientID of the player claiming to have won the game
   */
  commandClaimMade (command) {
    this.elements.status.innerText = `Player ${command.claimer} has claimed Bingo! Checking their card...`
  }

  /**
   * If a bingo claim is valid, the host will broadcast this to everyone, and it's game over.
   * Update the client with notification of this and
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.claimer - the ClientID of the player who has won the game
   */
  commandClaimValid (command) {
    this.classList.remove('started')
    this.classList.add('finished')
    this.elements.status.innerText = `Player ${command.claimer} has won!`
    this.elements.resetButton.disabled = false
  }

  /**
   * Once the host checks a claim and invalidates it, it sends a broadcast to all clients that the
   * game is continuing. This displays that message to the end user.
   *
   * @param {Object} command - the message sent from the relay
   * @param {string} command.claimer - the ClientID of the player disqualified from the game
   */
  commandClaimInvalid (command) {
    this.elements.status.innerText = `Player ${command.claimer} has an invalid card! They're disqualified and the game goes on...`
  }

  /**
   * Client Only
   *
   * The host, from time to time, will broadcast an updated player list. Clients listen to this
   * and recieve the player list, clear their local version, loop through it and add all players
   * back to their list. This way, all clients are kept in sync with the host.
   *
   * @param {Object} command - the message sent from the relay
   * @param {Array} command.players - array of ClientIDs that are connected to the game
   */
  commandUpdatePlayers (command) {
    if (this.party.role !== 'host') {
      this.party.players = []
      command.players.forEach((player) => {
        this.addPlayer(player)
      })
    }
  }
}

window.customElements.get('bingo-app') || window.customElements.define('bingo-app', BingoApp)

if(typeof module != 'undefined') module.exports = BingoApp;