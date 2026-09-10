<!-- Mounted with the first rendered frame: 1.8 s entrance + 1 s pause. -->
<header class="greeting">
  <h1><span>Hello World</span></h1>
  <p>I am Aparimeya</p>
</header>

<style>
  .greeting {
    position: absolute;
    top: max(36px, calc(6vh + env(safe-area-inset-top)));
    left: 20px;
    right: 20px;
    text-align: center;
    pointer-events: none;
    color: var(--text);
    text-shadow: 0 2px 16px #000b;
  }
  h1 {
    display: inline-block;
    width: 11ch;
    text-align: left;
    margin: 0;
    font: 400 clamp(24px, 4vw, 36px) / 1.3 var(--mono);
  }
  h1 span {
    display: inline-block;
    box-sizing: content-box;
    width: 11ch;
    overflow: hidden;
    white-space: nowrap;
    vertical-align: top;
    border-right: 1px solid transparent;
    animation:
      typewriter 990ms steps(11, end) 2.8s both,
      cursor 550ms step-end 2.8s 3;
  }
  p {
    margin: 12px 0 0;
    font-size: clamp(13px, 2vw, 15px);
    color: #b9b5c2;
    animation: reveal 450ms ease-out 3.95s both;
  }
  @keyframes typewriter {
    from {
      width: 0;
    }
    to {
      width: 11ch;
    }
  }
  @keyframes cursor {
    0%,
    50% {
      border-right-color: var(--accent);
    }
    51%,
    100% {
      border-right-color: transparent;
    }
  }
  @keyframes reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    h1 span,
    p {
      animation: reveal 1ms step-end 1s both;
    }
  }
</style>
