/**
 * The Relay class provides methods to send and recieve messsages from our message queue.
 * It's currently hardcoded to httprelay.io, but could be replaced with any MQ, like RabbitMQ,
 * SNS or other.
 *
 * @class Relay
 * @typedef {Relay}
 */
class Relay {
  /**
   * Creates an instance of Relay and sets initial client details
   *
   * @constructor
   * @param {string} room - a randomly-generated alphanumeric string of any length - the
   *  longer, the better
   */
  constructor (room) {
    this.url = `https://demo.httprelay.io/mcast/${room}`
    this.clientID = this.generateClientId()
    // Start listening for messages on the channel
    this.receive()
  }

  /**
   * Sets the handler method for dealing with
   *
   * @param {Object} handler
   */
  setResponseHandler (handler) {
    this.responseHandler = handler
  }

  /**
   * Generates a quite-unique identifier for the client, used to identify the player.
   *
   * @returns {string} - a randomly-allocated base-16 string, used to identify the client.
   */
  generateClientId () {
    const uint32 = window.crypto.getRandomValues(new Uint32Array(1))[0]
    return uint32.toString(16)
  }

  /**
   * Creates an open listening line to the relay server and passes any messages recieved back to the
   * callback handler. When the connection drops, due to a 524 timeout, or a client disconnection
   * it re-establishes the connection with the finally() call.
   *
   */
  receive () {
    fetch(this.url, { method: 'GET', credentials: 'include' })
      .then(response => response.text())
      .then(text => this.handleResponse(text))
      .finally(() => this.receive())
  }

  /**
   * Sends a message to the msync relay, which will be picked up by all connected clients.
   *
   * @param {Object} json - a JSON object with message details.
   * @param {string} json.command - The command to run, sent to all listeners
   */
  send (json) {
    const body = JSON.stringify(json)
    fetch(this.url, { method: 'POST', body, keepalive: true })
  }

  /**
   * Converts messages sent on the relay to custom events, which are picked up by the client.
   * Dispatches events on the response handler set in @{setResonseHandler}
   *
   * @param {string} json - a stringified JSON object returned from the relay relay
   */
  handleResponse (json) {
    const message = JSON.parse(json)
    const event = new CustomEvent('command', { detail: message })
    this.responseHandler.dispatchEvent(event)
  }

  /**
   * Sends a request for the host to identify themselves.
   */
  getGameHost () {
    this.send({ command: 'hostidentify' })
  }

  /**
   * Sends a request to join a game, but must await confirmation of joining.
   */
  joinGame () {
    this.send({ command: 'join', clientID: this.clientID })
  }

  /**
   * Host function that broadcasts that a new player has joined the game.
   *
   * @param {string} clientID - the alphanumeric identifier of the player that has just joined.
   */
  joined (clientID) {
    this.send({ command: 'joined', clientID })
  }

  /**
   * Host function that sends a 'please wait' message to a player when they requets to join a game,
   * but a game is already underway.
   */
  hold () {
    this.send({ command: 'hold', clientID: this.clientID })
  }

  /**
   * Sends a notification that a player has left the game, used to update the player list. Called by
   * onBeforeUnload on the client side.
   */
  leaveGame () {
    this.send({ command: 'leave', clientID: this.clientID })
  }

  /**
   * Host function to notify all players that a game is about to start.
   */
  startGame () {
    this.send({ command: 'start' })
  }

  /**
   * Host function to notify all players that they should reset their app, ready for the next game.
   */
  resetGame () {
    this.send({ command: 'reset' })
  }

  /**
   * Host function to notify clients that the next ball has been called.
   *
   * @param {int} number - a randomly-generated number between 0 and 90, not already in @{calledNumbers}
   * @param {Array} calledNumbers - an array containing all previously called numbers for this game.
   */
  callNumber (number, calledNumbers) {
    this.send({ command: 'call', number, calledNumbers })
  }

  /**
   * Client function that registers a claim of bingo! This is broadcast to the host only, who verfies that
   * the player is not already disqualified, and the calling of numbers is paused. We pass the gamecard to
   * the host who verifies the claim, sending either @{claimValid} or @{claimInvalid} to all clients.
   *
   * @param {Array} gamecard - an array of integers, exactly 25 in length
   */
  claim (gamecard) {
    this.send({ command: 'claim', claimer: this.clientID, gamecard })
  }

  /**
   * Host function that broadcasts to all clients that a claim has been made, so that clients can update
   * messaging to notify their users.
   *
   * @param {string} claimer - the alphanumeric identifier of the player that has just claimed bingo!
   */
  claimMade (claimer) {
    this.send({ command: 'claimmade', claimer })
  }

  /**
   * Host function that broadcasts to all clients that the game has been won, after verifying the claim.
   *
   * @param {string} claimer - the alphanumeric identifier of the player that has just claimed bingo!
   */
  claimValid (claimer) {
    this.send({ command: 'claimvalid', claimer })
  }

  /**
   * Host function that broadcasts to all clients that the game is continuing because the bingo claim was
   * invalid, and the player has now been disqualified.
   *
   * @param {string} claimer - the alphanumeric identifier of the player that has just claimed bingo!
   */
  claimInvalid (claimer) {
    this.send({ command: 'claiminvalid', claimer })
  }

  /**
   * Host function to broadcast an updated list of players, to ensure all clients stay in sync. Clients
   * will keep a local copy of this player list and display it to their user.
   *
   * @param {Array} players - an array of all player ClientIDs
   */
  broadcastPlayers (players) {
    this.send({ command: 'players', players })
  }

  /**
   * Host function to respond to @{getGameHost}, letting the requester know that this client is acting
   * as the host of the game.
   */
  identifyAsHost () {
    this.send({ command: 'iamhost', clientID: this.clientID })
  }
}