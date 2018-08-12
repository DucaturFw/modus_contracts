pragma solidity ^0.4.24;

// File: contracts/openzeppelin/contracts/math/SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that revert on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, reverts on overflow.
  */
  function mul(uint256 _a, uint256 _b) internal pure returns (uint256) {
    // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
    if (_a == 0) {
      return 0;
    }

    uint256 c = _a * _b;
    require(c / _a == _b);

    return c;
  }

  /**
  * @dev Integer division of two numbers truncating the quotient, reverts on division by zero.
  */
  function div(uint256 _a, uint256 _b) internal pure returns (uint256) {
    require(_b > 0); // Solidity only automatically asserts when dividing by 0
    uint256 c = _a / _b;
    // assert(_a == _b * c + _a % _b); // There is no case in which this doesn't hold

    return c;
  }

  /**
  * @dev Subtracts two numbers, reverts on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 _a, uint256 _b) internal pure returns (uint256) {
    require(_b <= _a);
    uint256 c = _a - _b;

    return c;
  }

  /**
  * @dev Adds two numbers, reverts on overflow.
  */
  function add(uint256 _a, uint256 _b) internal pure returns (uint256) {
    uint256 c = _a + _b;
    require(c >= _a);

    return c;
  }
}


// File: contracts/openzeppelin/contracts/ownership/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipRenounced(address indexed previousOwner);
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  constructor() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to relinquish control of the contract.
   * @notice Renouncing to ownership will leave the contract without an owner.
   * It will not be possible to call the functions with the `onlyOwner`
   * modifier anymore.
   */
  function renounceOwnership() public onlyOwner {
    emit OwnershipRenounced(owner);
    owner = address(0);
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function transferOwnership(address _newOwner) public onlyOwner {
    _transferOwnership(_newOwner);
  }

  /**
   * @dev Transfers control of the contract to a newOwner.
   * @param _newOwner The address to transfer ownership to.
   */
  function _transferOwnership(address _newOwner) internal {
    require(_newOwner != address(0));
    emit OwnershipTransferred(owner, _newOwner);
    owner = _newOwner;
  }
}

// File: contracts/Auction.sol

contract Auction is Ownable {
  using SafeMath for uint256;

  struct Bet {
    address sender;
    uint256[] amounts;
    bytes20 secretHash;
  }

  struct LotPart {
    address token;
    uint256 part;
  }

  struct Lot {
    address owner;
    LotPart[] parts;
    uint256 expiration;

    uint256 betCount;
    mapping (uint256 => Bet) bets;

    // Index of current winning bet
    uint256 winningBet;
    uint256 winningScore;
    bytes20 winningsecretHash;
    
  }

  uint256 public lotCount;
  mapping (uint256 => Lot) public lots;


  event CreateLot(uint256 indexed lot, address indexed owner, address[] tokens, uint256[] parts, uint256 amountETH);
  event CreateBet(uint256 indexed lot, address indexed sender, uint256 bet, uint256[] amounts, bytes20 secretHash);


  modifier lotAlive(uint256 lot) {
    require(lots[lot].expiration > 0 && lots[lot].expiration > now);
    _;
  }

  modifier lotExpired(uint256 lot) {
    require(lots[lot].expiration > 0 && lots[lot].expiration <= now);
    _;
  }


  function createLot(uint256 ftId, address[] tokens, uint256[] parts, uint256 amountETH) public returns (uint256 lot) {
    require(tokens.length > 0 && tokens.length == parts.length);
    lot = ftId;
    lots[lot].owner = msg.sender; // ?
    lots[lot].parts.length = tokens.length;
    //uint256 partsSum = 0;
    for (uint256 i = 0; i < tokens.length; ++i) {
      lots[lot].parts[i].token = tokens[i];
      lots[lot].parts[i].part = parts[i];
      //partsSum = partsSum.add(parts[i]);
    }
    lots[lot].expiration = now + 10 seconds;
    //require(partsSum == 1**18); // ?
    lotCount = ftId; // for testing
    lots[lotCount].betCount = 1;
    emit CreateLot(lot, owner, tokens, parts, amountETH);
  }

  function createBet(uint256 lot, uint256[] amounts, bytes20 secretHash) public lotAlive(lot) returns (uint256 bet) {
    require(lots[lot].parts.length == amounts.length);
    bet = lots[lot].betCount;
    lots[lot].bets[bet].sender = msg.sender;
    lots[lot].bets[bet].amounts = new uint256[](amounts.length);
    for (uint256 i = 0; i < amounts.length; ++i) {
      lots[lot].bets[bet].amounts[i] = amounts[i];
    }
    lots[lot].bets[bet].secretHash = secretHash;
    lots[lot].betCount = lots[lot].betCount.add(1);
    uint256 betScore = calculateScore(lots[lot].bets[bet].amounts);
    if (bet == 0) {
      lots[lot].winningBet = 1;
      lots[lot].winningScore = betScore;
      lots[lot].winningsecretHash = secretHash;
    } else if (lots[lot].winningScore < betScore) {
      lots[lot].winningBet = bet;
      lots[lot].winningScore = betScore;
      lots[lot].winningsecretHash = secretHash;
    }
    emit CreateBet(lot, lots[lot].bets[bet].sender, bet, lots[lot].bets[bet].amounts, lots[lot].bets[bet].secretHash);
  }

  function getWinBetInfo(uint256 lot) public view lotExpired(lot) returns (uint256 score,bytes20 secretHash){
       score = lots[lot].winningScore;
       secretHash = lots[lot].winningsecretHash;
  }

  function getWinningBet(uint256 lot) public view lotExpired(lot) returns (uint256 betID) {
    betID = lots[lot].winningBet;
    //return(,lots[lot].winningScore,lots[lot].winningsecretHash);
  }

  function getBetSender(uint256 lot, uint256 bet) public view returns (address) {
    return lots[lot].bets[bet].sender;
  }

  function getBetAmounts(uint256 lot, uint256 bet) public view returns (uint256[]) {
    return lots[lot].bets[bet].amounts;
  }

  function getBetSecretHash(uint256 lot, uint256 bet) public view returns (bytes20) {
    return lots[lot].bets[bet].secretHash;
  }


  function calculateScore(uint256[] storage amounts) private view returns (uint256 score) {
    score = 0;
    for (uint256 i = 0; i < amounts.length; ++i) {
      score = score.add(amounts[i]);
    }
  }

}
