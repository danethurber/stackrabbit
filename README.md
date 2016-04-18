# StackRabbit [Beta]

[![Circle CI](https://circleci.com/gh/danethurber/stackrabbit.svg?style=shield)](https://circleci.com/gh/danethurber/stackrabbit)

[Koa](https://github.com/koajs/koa) inspired(some might say copied) framework for writing RabbitMQ Listeners.

>Expressive ~~HTTP~~ __RabbitMQ__ middleware for node.js to make ~~web applications and APIs~~ __Rabbit Listeners__ more enjoyable to write. ~~Koa's~~ __StackRabbit's__ middleware stack flows in a stack-like manner, allowing you to perform actions downstream then filter and manipulate the response upstream. ~~Koa's~~ __StackRabbit's__ use of generators also greatly increases the readability and robustness of your application.

## Installation

```
npm install stack-rabbit
```
## Getting Started

```js
const stackrabbit = require('stackrabbit')
const contentParser = require('stackrabbit-content-parser')

const listener = stackrabbit({
  queueName: 'some-queue',
  rabbitUrl: 'amqp://guest:guest@rabbit.dev:5672'
})

// You can write middleware just like in Koa
listener.use(function *(next){
  const start = new Date()
  yield next
  const ms = new Date() - start
  console.log('message processed in %s', ms)
})

// Use some more middleware
listener.use(contentParser())

listener.listen(function * () {
  // do something with the message.
  // this.content is available when using the contentParser middleware
  console.log(this.content)

  // make sure to acknowledge you processed the message
  this.app.channel.ack(this.message)
})

listener.on('error', (err) => {
  console.error(err.stack)
})

listener.connect()
```

## Guide

This guide includes suggestions and best practices for using stackrabbit.

### Writing Middleware

Middleware in stackrabbit, much like [middleware in koa](https://github.com/koajs/koa/blob/master/docs/guide.md#writing-middleware), are simple functions which return a `GeneratorFunction` and accept another. When the middleware is run by an "upstream" middleware, it must manually `yield` to the "downstream" middleware.

Here is an example of adding a unique guid to the header of each message and logging before and after the message has been processed.

```js
const uuid = require('node-uuid')

listener.use(function * requestId(next) {
  const start = new Date()
  const headers = this.message.properties.headers

  headers['x-request-id'] = headers['x-request-id'] || uuid.v4()

  console.log('Processing Message: %s', headers['x-request-id'])

  yield next

  const ms = new Date() - start
  console.log('Message %s Processed in %s ms', headers['x-request-id'], ms)
})

```

### Middleware Best Practices

When creating public middleware it's useful to conform to the convention of wrapping the middleware in a function that accepts options, allowing users to extend functionality. Even if your middleware accepts no options, this is still a good idea to keep things uniform.

Here is a requestId middleware that allows changing the header key through configuration.

```js
function requestId(key) {
  key = key || 'x-request-id'

  return function * requestId(next){
    const headers = this.message.properties.headers
    headers[key] = headers[key] || uuid.v4()

    yield next
  }
}

app.use(requestId());
app.use(requestId('some-other-key'));
```

### Named Middleware

Naming your middleware is optional but it helps debugging.

```js
function namedFn() {
  return function * namedFn(next){
    yield next
  }
}
```

### Error Handling

Errors thrown in the middleware stack or message handler with be caught and the application with emit an event of name `error`. You should listen for this event and log it accordingly.

```js
listener.on('error', (err) => {
  console.error(err.stack)
})
```

Inside of your middleware you can easily try/catch the downstream middleware to handle the event. Make sure you throw the error when you're done so the errors can be handled by functions earlier in the middleware chain and get caught in the default error handler.

```js
listener.use(function * (next){
  try {
    yield next
  } catch (err) {
    //  do something with the err
    throw err
  }
})
```

## Available Middleware

stackrabbit does not come bundled with any middleware. you'll might want to include some of these packages.

- [stackrabbit-request-id](https://github.com/danethurber/stackrabbit-request-id)
- [stackrabbit-content-parser](https://github.com/danethurber/stackrabbit-content-parser)
- [stackrabbit-bunyan](https://github.com/danethurber/stackrabbit-bunyan)
- [stackrabbit-newrelic](https://github.com/danethurber/stackrabbit-newrelic)

## License

MIT
