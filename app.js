const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
//initializeDbAndServer
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running now");
    });
  } catch (e) {
    console.log(`Db error:${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//1 API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  // const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const userDetailsQuery = `SELECT * FROM user WHERE username="${username}";`;
  const userArray = await db.get(userDetailsQuery);

  if (userArray === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, userArray.password);
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      };
      const jwsToken = jwt.sign(payload, "my_secret_code");
      console.log(jwsToken);
      response.send({ jwsToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication
const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_secret_code", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        response.send("Success token");
        next();
      }
    });
  }
};

//object formatting
const changeObjectFormat = (eachObject) => {
  return {
    stateId: eachObject.state_id,
    stateName: eachObject.state_name,
    population: eachObject.population,
  };
};

// api 2
app.get("/states/", authorization, async (request, response) => {
  const username = request.username;
  const query = `SELECT * FROM state;`;
  const array = await db.all(query);
  response.send(array);
  const resultArray = array.map((eachObject) => changeObjectFormat(eachObject));
  response.send(resultArray);
});

// api 3
app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const query = `SELECT * FROM state WHERE state_id=${stateId};`;
  const array = await db.get(query);
  const resultObject = changeObjectFormat(array);
  response.send(resultObject);
});

//api 4
app.module.exports = app;
