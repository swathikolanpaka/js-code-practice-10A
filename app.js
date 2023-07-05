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
      const jwtToken = jwt.sign(payload, "my_secret_code");
      console.log(jwtToken);
      response.send({ jwtToken });
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
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;

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
  const query = `SELECT * FROM state;`;
  const array = await db.all(query);

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

app.post("/districts/", authorization, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const query = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
  VALUES
  (
      "${districtName}",
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
      
  );`;

  const dbResult = await db.run(query);
  response.send("District Successfully Added");
});

// changing district object format
const districtObject = (eachObject) => {
  return {
    districtId: eachObject.district_id,
    districtName: eachObject.district_name,
    stateId: eachObject.state_id,
    cases: eachObject.cases,
    cured: eachObject.cured,
    active: eachObject.active,
    deaths: eachObject.deaths,
  };
};

// api 5
app.get("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const query = `SELECT * FROM district WHERE district_id=${districtId};`;
  const array = await db.get(query);
  const resultObject = districtObject(array);
  response.send(resultObject);
});

//api 6
app.delete(
  "/districts/:districtId/",
  authorization,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `DELETE FROM district WHERE district_id=${districtId};`;
    // const array = await db.get(query);
    // const resultObject = districtObject(array);
    response.send("District Removed");
  }
);

// api 7
app.put("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;

  const districtDetails = request.body;
  //console.log(districtDetails);
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  //console.log(districtDetails);

  const query = `UPDATE district
  SET
  district_name="${districtName}",
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths} WHERE district_id=${districtId};`;
  await db.run(query);

  response.send("District Details Updated");
});

//api 8
app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;

  const query = `SELECT SUM(district.cases) AS totalCases,SUM(district.cured) AS totalCured,SUM(district.active) AS totalActive,SUM(district.deaths) AS totalDeaths 
  FROM state INNER JOIN district ON state.state_id=district.district_id
  WHERE state_id=${stateId};`;
  const dbResult = await db.get(query);
  response.send(dbResult);
});
module.exports = app;
