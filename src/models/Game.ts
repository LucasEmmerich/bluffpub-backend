import Player from '../models/Player.js';

const DECK: Array<Card> = [
    { id: 1, name: 'King', values: ['King'], img: '/cards/king.png' },
    { id: 2, name: 'King', values: ['King'], img: '/cards/king.png' },
    { id: 3, name: 'King', values: ['King'], img: '/cards/king.png' },
    { id: 4, name: 'King', values: ['King'], img: '/cards/king.png' },
    { id: 5, name: 'King', values: ['King'], img: '/cards/king.png' },
    { id: 6, name: 'King', values: ['King'], img: '/cards/king.png' },
    { id: 7, name: 'Queen', values: ['Queen'], img: '/cards/queen.png' },
    { id: 8, name: 'Queen', values: ['Queen'], img: '/cards/queen.png' },
    { id: 9, name: 'Queen', values: ['Queen'], img: '/cards/queen.png' },
    { id: 10, name: 'Queen', values: ['Queen'], img: '/cards/queen.png' },
    { id: 11, name: 'Queen', values: ['Queen'], img: '/cards/queen.png' },
    { id: 12, name: 'Queen', values: ['Queen'], img: '/cards/queen.png' },
    { id: 13, name: 'Jack', values: ['Jack'], img: '/cards/jack.png' },
    { id: 14, name: 'Jack', values: ['Jack'], img: '/cards/jack.png' },
    { id: 15, name: 'Jack', values: ['Jack'], img: '/cards/jack.png' },
    { id: 16, name: 'Jack', values: ['Jack'], img: '/cards/jack.png' },
    { id: 17, name: 'Jack', values: ['Jack'], img: '/cards/jack.png' },
    { id: 18, name: 'Jack', values: ['Jack'], img: '/cards/jack.png' },
    { id: 19, name: 'Joker', values: ['King', 'Queen', 'Jack'], img: '/cards/joker.png' },
    { id: 20, name: 'Joker', values: ['King', 'Queen', 'Jack'], img: '/cards/joker.png' },
];

const INITIAL_PLAYER_LIFE: number = 3;

type Card = {
    id: number;
    name: string;
    values: string[];
    img: string;
    selected?: boolean;
};

type Hand = {
    player: Player;
    cards: Card[];
    life: number;
};

type Table = {
    cards: Card[];
    moves: Move[];
};

export type Move = {
    player: Player;
    cardsDropped: Card[];
    liarCall: boolean;
};

export type BluffResult = {
    bluffed: boolean;
    loser: Player;
    eliminated: boolean;
    gameOver: boolean;
    winner?: Player;
    tableCards: Card[];
};

export default class Game {
    round: number;
    cardTypes: Array<'King' | 'Queen' | 'Jack'> = ['King', 'Queen', 'Jack'];
    cardType: 'King' | 'Queen' | 'Jack';
    players: Player[];
    turn: Player;
    matchStarted: boolean;
    deck: Card[];
    hands: Hand[];
    table: Table = { cards: [], moves: [] };

    constructor(players: Player[]) {
        this.players = players;
        this.matchStarted = true;
        this.round = 1;
        this.deck = this.getShuffledDeck();
        this.cardType = this.getRandomCardType();
        this.turn = this.getRandomPlayer();
        this.hands = this.dealHands();
    }

    private getShuffledDeck = (): Card[] => [...DECK].sort(() => Math.random() - 0.5);
    private getRandomCardType = (): 'King' | 'Queen' | 'Jack' =>
        this.cardTypes[Math.floor(Math.random() * this.cardTypes.length)];
    private getRandomPlayer = (): Player => this.players[Math.floor(Math.random() * this.players.length)];

    private dealHands = (): Hand[] => {
        const hands: Hand[] = [];
        for (const p of this.players) {
            hands.push({ player: p, cards: this.deck.splice(0, 5), life: INITIAL_PLAYER_LIFE });
        }
        return hands;
    };

    private dealNewCards = () => {
        this.deck = this.getShuffledDeck();
        for (const hand of this.hands) {
            hand.cards = this.deck.splice(0, 5);
        }
    };

    private eliminatePlayer = (playerId: string) => {
        this.players = this.players.filter((p) => p.id !== playerId);
        this.hands = this.hands.filter((h) => h.player.id !== playerId);
    };

    private startNewRound = () => {
        this.table = { cards: [], moves: [] };
        this.dealNewCards();
        this.cardType = this.getRandomCardType();
        this.turn = this.getRandomPlayer();
        this.round++;
    };

    private removeCardsFromPlayerHand = (move: Move) => {
        const hand = this.hands.find((h) => h.player.id === move.player.id);
        if (!hand) return;
        const droppedIds = new Set(move.cardsDropped.map((d) => d.id));
        hand.cards = hand.cards.filter((c) => !droppedIds.has(c.id));
    };

    private setNextPlayer = () => {
        const currentIndex = this.players.findIndex((p) => p.id === this.turn.id);
        this.turn = this.players[(currentIndex + 1) % this.players.length];
    };

    private lastPlayerBluffed = (): boolean => !this.table.cards.every((card) => card.values.includes(this.cardType));

    private getLastMove = (): Move => this.table.moves[this.table.moves.length - 1];

    public dropCards(move: Move) {
        this.removeCardsFromPlayerHand(move);
        this.table.cards = move.cardsDropped;
        this.table.moves.push(move);
        this.setNextPlayer();
        this.round++;
    }

    public skipTurn(): void {
        this.setNextPlayer();
    }

    public forfeitTurn(): BluffResult {
        const currentHand = this.hands.find((h) => h.player.id === this.turn.id);
        if (!currentHand) {
            this.setNextPlayer();
            return { bluffed: false, loser: this.turn, eliminated: false, gameOver: false, tableCards: [] };
        }
        currentHand.life--;
        const eliminated = currentHand.life <= 0;
        if (eliminated) this.eliminatePlayer(currentHand.player.id);
        const gameOver = this.players.length <= 1;
        if (gameOver) this.matchStarted = false;
        else this.startNewRound();
        return {
            bluffed: false,
            loser: currentHand.player,
            eliminated,
            gameOver,
            winner: gameOver ? this.players[0] : undefined,
            tableCards: [],
        };
    }


    public playerLeft(playerId: string): BluffResult {
        const hand = this.hands.find((h) => h.player.id === playerId);
        if (!hand) {
            return { bluffed: false, loser: { id: playerId, username: '', avatar: 0 }, eliminated: false, gameOver: false, tableCards: [] };
        }
        const tableCards = [...this.table.cards];
        this.eliminatePlayer(playerId);
        const gameOver = this.players.length <= 1;
        if (gameOver) this.matchStarted = false;
        else this.startNewRound();
        return {
            bluffed: false,
            loser: hand.player,
            eliminated: true,
            gameOver,
            winner: gameOver ? this.players[0] : undefined,
            tableCards,
        };
    }

    public callBluff(callerPlayer: Player): BluffResult {
        if (this.table.moves.length === 0) {
            throw new Error('Não há jogadas para chamar de mentiroso.');
        }

        const tableCards = [...this.table.cards];
        const lastMove = this.getLastMove();
        const lastHand = this.hands.find((h) => h.player.id === lastMove.player.id);
        const callerHand = this.hands.find((h) => h.player.id === callerPlayer.id);
        if (!lastHand || !callerHand) throw new Error('Hand not found during bluff resolution.');

        const bluffed = this.lastPlayerBluffed();
        const loserHand = bluffed ? lastHand : callerHand;
        loserHand.life--;

        const eliminated = loserHand.life <= 0;
        if (eliminated) {
            this.eliminatePlayer(loserHand.player.id);
        }

        const gameOver = this.players.length <= 1;
        if (gameOver) this.matchStarted = false;
        else this.startNewRound();

        return {
            bluffed,
            loser: loserHand.player,
            eliminated,
            gameOver,
            winner: gameOver ? this.players[0] : undefined,
            tableCards,
        };
    }
}
