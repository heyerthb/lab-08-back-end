'use strict';

require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');


// DATABASE SETUP
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err)); //check to see if it works.

// Application Setup
const PORT = process.env.PORT;
const app = express();

app.use(cors());

app.get('/location', handleLocationRequest);
app.get('/weather', handleWeatherRequest);
app.get('/events', handleEvents);


//  route handles/////////////////////////////

function handleLocationRequest(request, response){

  const sql = `SELECT * FROM locations WHERE search_query='${query}'`;

  return client.query(sql)
    .then(results => {
      if(results.rowCount > 0) {
        console.log('...............from cache!');
        return results.rows;
      } else {
        const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEO_API_KEY}`;
        return superagent.get(URL)
          .then(response => {
            let location = new Location(query, response.body.results[0] );


            const insertSQL = `
        INSERT INTO locations (search_query, formatted_query, latitude, longitude)
        VALUES('${location.search_query}','${location.formatted_query}', ${location.latitude}, ${location.longitude});
        `;
            return client.query(insertSQL).then(results => {
              console.log('insert status', results.rows);
              console.log('.................from api and cached!')
              return location;
            }).catch(err => console.error(err));


          })
          .catch(error => {
            console.error(error);
          });
      }
    })
    .catch(err => console.error(err));
// if so then return "cached" version
// SELECT * FROM locations WHERE search_query = the query passed
// if not do below
//
}




const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEO_API_KEY}`;

return superagent.get(URL)
  .then(res => {
    const location = new Location(request.query.data, res.body);

    // console.log('the location', location);
    response.send(location);
  })

  .catch(error=>{
    handleError(error, response);
  })




function handleWeatherRequest(request, response){
  const URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API}/${request.query.data.latitude},${request.query.data.longitude}`;
  // console.log('URL' ,URL)
  return superagent.get(URL)

    .then(res => {
      let weatherArray = res.body.daily.data.map(day => {
        let weather = new Weather(day);

        // console.log('weather', weather);
        return weather;
      })

      // console.log('weather array' , weatherArray)
      response.send(weatherArray);
    })

    .catch(error=>{
      handleError(error, response);
    })
}



function handleEvents(request, response){
  getEvents(request.query)
    .then(data => response.send(data))
    .catch(error => handleError(error) )
}



function getEvents(query){
  let URL = `https://www.eventbriteapi.com/v3/events/search?location.address=${query}&location.within=1km`
  return superagent.get(URL)
    .set('Authorization', `Bearer ${process.env.EVENT_BRITE}`)
    .then(data => data.body.events.map(event => new Event(event)) )
    .catch(error => handleError(error));
}

// Helper Functions



function Weather(day) {
  this.time = day.time,
  this.forecast = day.summary,
  this.time = new Date(day.time * 1000).toString().slice(0,15);
}

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address,
  this.latitude = geoData.results[0].geometry.location.lat,
  this.longitude = geoData.results[0].geometry.location.lng;
}

function Event(event) {
  this.link = event.url,
  this.name = event.name.text,
  this.event_date = event.start.local,
  this.summary = event.summary;
}


function handleError(error, response){
  console.error(error);
  response.status(500).send('Working on it!');
}


app.listen(PORT, () => console.log(`App is listening on ${PORT}`));
