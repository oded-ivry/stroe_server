// import an configure .env files
require("dotenv").config();

const Primus = require("primus");
const Rooms = require("primus-rooms");

//getting  user router
const user_router = require("./modules/user/user.router");
const account_router = require("./modules/account/account.router");
const products_router = require("./modules/products/products.router");
const { error_handler, not_found } = require("./middleware/errors.handler");

const express = require("express");
const cors = require("cors");

//define app as an instance of express
const app = express();

//set db as an instance of the db I have locally on my pc
const db = require("./db/mongoose.connection");

app.use(cors());

//The process.env property returns an object containing the user environment
//Then we distructure what we need from that object
const { API_PORT, API_HOST } = process.env;
const port = API_PORT || 3000;

//allows express the ability to json parse
app.use(express.json());

//tells the app of an api endpoint called users
app.use("/products", products_router);
app.use("/api/users", user_router);
app.use("/account", account_router);

//test get method
app.get("/", function (req, res) {
  res.send("Hello from store");
});
// central error handling
app.use(error_handler);

//when no routes were matched...
app.use("*", not_found);

//self excuting function to start the express api server

(async () => {
  //connect to mongo db
  await db.connect();
  //start listening on a certain port
  let server = await app.listen(port, API_HOST, () => {
    console.log(`Store app listening on  http://${API_HOST}:${API_PORT} !`);
  });
  //------------------------------------------------------------------**
  //-------------------------chat server------------------------------**
  //------------------------------------------------------------------**
  let primus = new Primus(server, { transformer: "sockjs" });
  // add rooms to Primus
  primus.plugin("rooms", Rooms);

  primus.on("connection", (spark) => {
    console.log("--> spark.id: ", spark.id);

    spark.on("data", (data = {}) => {
      console.log(data, "--> data:");

      const { action, room, message } = data;

      console.log(`action:`, action);
      console.log(`room:`, room);
      console.log(`message:`, message);

      // join a room
      if (action === "join") {
        spark.join(room, () => {
          // send message to this client
          spark.write("you joined room " + room);
          // send message to all clients except this one
          spark
            .room(room)
            .except(spark.id)
            .write(`${spark.id} joined room ${room}`);
        });
      }

      // leave a room
      if (action === "leave") {
        spark.leave(room, () => {
          // send message to this client
          spark.write("you left room " + room);
          // send message to all clients except this one
          spark
            .room(room)
            .except(spark.id)
            .write(spark.id + " left room " + room);
        });
      }
      // Send a message to a room
      if (message && room) {
        console.log(`writing message to room  ${room}`);
        spark.room(room).write(message);
      }
      if (message && room === undefined) {
        console.log(`writing message to all  ${message}`);
        primus.write(message);
      }
    });
  });
})().catch(console.log);
