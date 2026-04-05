// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAutomatable}        from "../interfaces/IAutomatable.sol";
import {IAutomationRegistry} from "../interfaces/IAutomationRegistry.sol";

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool
    );
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee()    external view returns (uint24);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata) external returns (uint256);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/// @notice On-chain momentum strategy on a Uniswap V3 pool.
///
/// Tracks the pool tick. When it moves >= `thresholdTicks` from the last
/// recorded value, a rebalance is triggered:
///   price UP   → swap all token1 into token0  (ride token0)
///   price DOWN → swap all token0 into token1  (ride token1)
///
/// `lastTick` always updates on trigger, even with no balance to swap,
/// so the threshold trails the current price level.
///
/// Tick scale: 1 tick ≈ 0.01% move  |  100 ticks ≈ 1%  |  500 ticks ≈ 5%
contract MomentumStrategy is IAutomatable {

    IUniswapV3Pool public immutable pool;
    ISwapRouter    public immutable swapRouter;
    address        public immutable registry;
    address        public immutable owner;
    address        public immutable token0;
    address        public immutable token1;
    uint24         public immutable poolFee;
    int24          public immutable thresholdTicks;
    uint256        public immutable solverPayment;

    int24 public lastTick;

    event Rebalanced(int24 fromTick, int24 toTick, bool priceUp, uint256 amountIn, uint256 amountOut);
    event Withdrawn(address token, uint256 amount);

    error OnlyOwner();
    error OnlyRegistry();
    error ThresholdNotReached(int24 delta, int24 required);

    constructor(
        address _pool,
        address _swapRouter,
        address _registry,
        address _owner,
        int24   _thresholdTicks,
        uint256 _solverPayment
    ) payable {
        require(_thresholdTicks > 0,  "threshold must be > 0");
        require(_solverPayment  > 0,  "solver payment must be > 0");
        require(_owner != address(0), "zero owner");

        pool           = IUniswapV3Pool(_pool);
        swapRouter     = ISwapRouter(_swapRouter);
        registry       = _registry;
        owner          = _owner;
        token0         = IUniswapV3Pool(_pool).token0();
        token1         = IUniswapV3Pool(_pool).token1();
        poolFee        = IUniswapV3Pool(_pool).fee();
        thresholdTicks = _thresholdTicks;
        solverPayment  = _solverPayment;
        lastTick       = _tick();

        IAutomationRegistry(_registry).register{value: msg.value}(_owner);
    }

    // IAutomatable functions

    function checkUpkeep() external view override returns (bool, bytes memory) {
        int24 delta = _absDelta(_tick(), lastTick);
        return (delta >= thresholdTicks, "");
    }

    function performUpkeep(bytes calldata) external override returns (uint256) {
        if (msg.sender != registry) revert OnlyRegistry();

        int24 prev    = lastTick;
        int24 current = _tick();
        int24 delta   = _absDelta(current, prev);

        if (delta < thresholdTicks) revert ThresholdNotReached(delta, thresholdTicks);

        bool priceUp = current > prev;
        lastTick = current;

        (address tokenIn, address tokenOut) = priceUp
            ? (token1, token0)
            : (token0, token1);

        uint256 amountIn  = IERC20(tokenIn).balanceOf(address(this));
        uint256 amountOut = amountIn > 0 ? _swap(tokenIn, tokenOut, amountIn) : 0;

        emit Rebalanced(prev, current, priceUp, amountIn, amountOut);
        return solverPayment;
    }

    // ── Owner ─────────────────────────────────────────────────────────────────

    function withdraw(address token, uint256 amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", owner, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
        emit Withdrawn(token, amount);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _tick() internal view returns (int24 tick) {
        (, tick,,,,,) = pool.slot0();
    }

    function _absDelta(int24 a, int24 b) internal pure returns (int24) {
        return a >= b ? a - b : b - a;
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256) {
        IERC20(tokenIn).approve(address(swapRouter), amountIn);
        return swapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn, tokenOut: tokenOut, fee: poolFee,
            recipient: address(this), deadline: block.timestamp,
            amountIn: amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0
        }));
    }
}
