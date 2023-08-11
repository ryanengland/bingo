## Welcome to Squid Bingo!

This was a LOT of fun. I really enjoy working with real-time collaboration tools like this. But I took a bit of a different slant on the problem.

#### Today's programmer has a wealth of libraries at their disposal.

A good programmer can spin up a real-time engine using Node/Express and Pusher/WebSockets, style things with Tailwind and build out with Webpack. But what if they didn't exist? What if they suddenly pulled the plug and were no longer available? We'd be back in the dark ages. Where all you had was Notepad, Paint and the trusty \<table> to lay things out. OK, so it might not be that extreme, but I thought, what if we didn't have these libraries, and we only had plain HTML / JS / CSS. Can we build a game engine, just in the browser, that allowed real-time gameplay?

### Introducing: Squid Bingo - the browser-based Bingo engine.

OK, ok, so it's not entirely dependency free. We use a HTTP messaging queue from HTTPRelay.io. Messages in, messages out. But other than that, no libraries, no frameworks, no build processes, no extensions and (sorry) no Bootstrap or Tailwind. Just plain-as-day Javascript, with some CSS thrown in. It's raw code, written by hand, to serve a purpose.

#### Why the f\*\*k didn't you use tooling?

OK, I hear you. But to me, it's a little bit of a cheat. I would, of course, use them in the real world, but you asked for a technical test, and a good developer can string tools together and connect the dots, but a great developer can problem-solve within the limitations dictated to them. I wanted to demonstrate problem-solving, even if a project had zero budget for hosting, tools or platforms. I hope that makes sense.

#### Fine, fine, fine. So what is this?

It's a massively-multiplayer Bingo, based just in the browser. The first person to join assumes host responsibilities, and subsequent players can join. When they're ready, the host hits the button and the game begins. Numbers are called out and anyone can chime in with BINGO! When a winner is declared, everyone is reset and they can do it all again. But beware, if you make a false call, you'll be banished to the naughty step, where you'll have to wait until everyone else is good and ready.

#### What's under the hood?

I've been pretty interested in WebComponents of late, and I think they've been given a bad wrap, likely because they're often confused with Google Polymer or other variants, which are vendor-specific. They're browser-native, performant and really, really flexible. Squid Bingo is built as a WebComponent, with an eternalized relay library for interfacing with the messaging system. The idea here is that, although I've used the basic-bitch HTTPRelay.io demo server, this could be swapped out with any queue / message based system, SNS, RabbitMQ, or any node / PHP based message relay libraries, and just modify this adapter.

The current system allows:

*   Unlimited players in a single room
*   Player list synchronisation
*   Near-real-time latency
*   No server infrastructure (other than a message queue, I guess)
*   Access for those on budget, low-end devices and slower connections
*   Easy, class-based testing
*   No library overhead

What's more, the room-id-generator is currently static, but could be made dynamic to allow for multi-room play

#### But what about production?

Yes, this is clearly not production ready, it should be considered an MVP. If building for production I would go about this differently, offloading the host logic onto an Express server, using WebSockets (the `ws` library) for the real-time aspect. Messages could be signed by the server to avoid tampering. The logic would follow a very similar pattern to what is demonstrated in this repo, except most of the host-only functions would be moved to node. For the frontend, I would likely employ a Vue.js single file component, which would allow for easy state management and websockets interaction. _But where's the fun in that?_

**Also:** I was conscious of getting this to you in a timely manner, so haven't spent a great deal of time polishing UI or building an epic, sexy AF interface. I went with the straight-forward approach. This project is by no means a reflection of my user-interface prowess. I would like to make that clear.

Enjoy, just head to [https://squid-bingo.github.io](https://squid-bingo.github.io) to play.

## To run

`cd` into the project root and run `npx live-server`, which should open the browser to `http://localhost:8080`

## To test

`npm install` first, then run:
- `npm run test` - to run both unit tests and e2e tests
- `npm run test:unit` - to run unit tests with coverage
- `npm run test:e2e` - to run e2e tests