const RelayClass = require('../relay');
const BingoClass = require('../bingo');

jest.mock('../relay');
jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');

beforeEach(() => {
    jest.useFakeTimers();
  });

afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('bingo app', () => {

    it('should call relay constructor', () => {
        const BingoApp = new BingoClass(RelayClass);
        expect(RelayClass).toHaveBeenCalledTimes(1);
        expect(RelayClass).toHaveBeenCalledWith(BingoApp.room);
    });

    it('should set room be set to public room', () => {
        const BingoApp = new BingoClass(RelayClass);
        expect(BingoApp.room).toBe('vcbnhmweibcwe83732');
    });

    it('should set room be set to private room in test mode', () => {
        window.TEST_MODE = true;
        const BingoApp = new BingoClass(RelayClass);
        expect(BingoApp.room).toBe('kithnbftyudtghjenb73678');
    });

    it('should set responseHandler to an instance of itself ', () => {
        const BingoApp = new BingoClass(RelayClass);
        expect(BingoApp.relay.responseHandler).toBeInstanceOf(BingoClass);
    });

    it('should call registerEvents during constructor', () => {
        const spy = jest.spyOn(BingoClass.prototype, 'registerEvents');
        const BingoApp = new BingoClass(RelayClass);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should call setInitialState during constructor', () => {
        const spy = jest.spyOn(BingoClass.prototype, 'setInitialState');
        const BingoApp = new BingoClass(RelayClass);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should call getCurrentHost during constructor', () => {
        const spy = jest.spyOn(BingoClass.prototype, 'getCurrentHost');
        const BingoApp = new BingoClass(RelayClass);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should wait to assume the host role', () => {
        jest.spyOn(BingoClass.prototype, 'possiblyAssumeHost').mockImplementation(() => `Mocked possiblyAssumeHost`);
        jest.spyOn(BingoClass.prototype, 'getReady').mockImplementation(() => `Mocked getReady`);
        const BingoApp = new BingoClass(RelayClass);
        jest.advanceTimersByTime(4000);
        expect(BingoApp.possiblyAssumeHost).not.toHaveBeenCalled();
    });

    it('should assume host role after timeout', () => {
        jest.spyOn(BingoClass.prototype, 'possiblyAssumeHost').mockImplementation(() => `Mocked possiblyAssumeHost`);
        jest.spyOn(BingoClass.prototype, 'getReady').mockImplementation(() => `Mocked getReady`);
        const BingoApp = new BingoClass(RelayClass);
        jest.advanceTimersByTime(8000);
        expect(BingoApp.possiblyAssumeHost).toHaveBeenCalledTimes(1);
    });

    it('should create empty elements array when called with missing elements', () => {
        const BingoApp = new BingoClass(RelayClass);
        expect(BingoApp.elements).toMatchObject({
            status: null,
            players: null,
            called: null,
            next: null,
            startButton: null,
            resetButton: null,
            claimButton: null,
            gamecard: null
        });
    });

    const eventTest = [
        {
            event: 'hostidentify',
            method: 'commandHostIdentify'
        },
        {
            event: 'iamhost',
            method: 'commandHostIdentified'
        },
        {
            event: 'join',
            method: 'commandJoinGame'
        },
        {
            event: 'joined',
            method: 'commandJoinedGame'
        },
        {
            event: 'hold',
            method: 'commandHold'
        },
        {
            event: 'leave',
            method: 'commandLeaveGame'
        },
        {
            event: 'players',
            method: 'commandUpdatePlayers'
        },
        {
            event: 'start',
            method: 'commandStartGame'
        },
        {
            event: 'reset',
            method: 'commandResetGame'
        },
        {
            event: 'call',
            method: 'commandCall'
        },
        {
            event: 'claim',
            method: 'commandClaim'
        },
        {
            event: 'claimmade',
            method: 'commandClaimMade'
        },
        {
            event: 'claimvalid',
            method: 'commandClaimValid'
        },
        {
            event: 'claiminvalid',
            method: 'commandClaimInvalid'
        },
    ]

    for(let i = 0; i < eventTest.length; i++){

        it(`should listen for ${eventTest[i].event} event and call ${eventTest[i].method}`, () => {
            const BingoApp = new BingoClass(RelayClass);
            // Mock the function being called
            const spy = jest.spyOn(BingoClass.prototype, eventTest[i].method).mockImplementation(() => `Mocked ${eventTest[i].method}`);
            const eventDetail = { command: eventTest[i].event }
            const event = new CustomEvent('command', { detail: eventDetail });
            BingoApp.dispatchEvent(event);
            expect(spy).toHaveBeenCalledTimes(1);
        });

    }

    it('should generate an array of unique random numbers within the specified range and length with generateRandomNumbers', () => {
    
        const BingoApp = new BingoClass(RelayClass);
    
        const result = BingoApp.generateRandomNumbers(1, 90, 25);
    
        // Check is array and length
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(25);
    
        // Check if all numbers are within the specified range
        result.forEach((number) => {
          expect(number).toBeGreaterThanOrEqual(1);
          expect(number).toBeLessThanOrEqual(90);
        });
    
        // Check for duplicates
        const uniqueSet = new Set(result);
        expect(uniqueSet.size).toBe(25);
    
    });

    it('should generate a random number within the specified range with generateRandomNumber', () => {
        const BingoApp = new BingoClass(RelayClass);
    
        const result = BingoApp.generateRandomNumber(1, 90);
    
        // Should be a number between 1 and 90
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(90);
    });

    it('should generate a random number within the specified range, not already in array with generateRandomNumberNotAlreadyCalled ', () => {
        const BingoApp = new BingoClass(RelayClass);

        const existingArray = [...Array(45).keys()]; // Create an array of half the numbers
    
        const result = BingoApp.generateRandomNumberNotAlreadyCalled(1, 90, existingArray);
    
        // Should be a number between 1 and 90
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(90);

        // Should not appear in the existing array
        expect(existingArray.indexOf(result)).toBe(-1);

    });

});