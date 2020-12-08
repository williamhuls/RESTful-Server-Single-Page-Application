// Built-in Node.js modules
let path = require('path');

// NPM modules
let express = require('express');
let sqlite3 = require('sqlite3');
const { time } = require('console');


let app = express();
let port = 8000;

let public_dir = path.join(__dirname, 'public');
let template_dir = path.join(__dirname, 'templates');
let db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

// open stpaul_crime.sqlite3 database
// data source: https://information.stpaul.gov/Public-Safety/Crime-Incident-Report-Dataset/gppb-g9cg
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(express.static(public_dir));


// REST API: GET /codes
// Respond with list of codes and their corresponding incident type
app.get('/codes', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
        let data=[];
        let code=url.searchParams.get('code');
        let qry='';
        if(code!=null){qry=' WHERE code IN ('+code.toString()+')';}
        db.all('SELECT * From Codes'+qry ,[], (err,rows) => {
            if(rows.length==0){
                res.status(404).type(".txt").send("Error"); 
            }
            else{
                rows.forEach((row) => {
                    var code=row.code;
                    var incident=row.incident_type;
                    data.push({code: code, incident: incident});
                });
                console.log(data);
                res.status(200).type('json').send(data);
            }
        });
});

// REST API: GET /neighborhoods
// Respond with list of neighborhood ids and their corresponding neighborhood name
app.get('/neighborhoods', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    let data=[];
    let id=url.searchParams.get('id');
    let qry='';
    if(id!=null){qry=' WHERE neighborhood_number IN ('+id.toString()+')';}
    db.all('SELECT * From Neighborhoods'+qry,[], (err,rows) => {
        if(rows.length==0){
            res.status(404).type(".txt").send("Error"); 
        }
        else{
            rows.forEach((row) => {
                var id=row.neighborhood_number;
                var name=row.neighborhood_name;
                data.push({id: id, name: name});
            });
            res.status(200).type('json').send(data);
        }
    });
});

// REST API: GET/incidents
// Respond with list of crime incidents
app.get('/incidents', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    let data=[];
    let qry='';

    let start_date=url.searchParams.get('start_date');
    let end_date=url.searchParams.get('end_date');
    let code=url.searchParams.get('code');
    let grid=url.searchParams.get('grid');
    let neighborhood=url.searchParams.get('neighborhood');
    let limit=url.searchParams.get('limit');

    if(start_date==null){start_date='2014-08-14';}
    if(end_date==null){end_date='2020-11-26';}
    if(limit==null){limit=1000;}

    qry=qry+" WHERE case_number > 0";

    if(code!=null){qry=qry+' AND code IN ('+code.toString()+')';}
    if(grid!=null){qry=qry+' AND grid IN ('+grid.toString()+')';}
    if(neighborhood!=null){qry=qry+' AND neighborhood_number IN ('+neighborhood.toString()+')';}

    db.all('SELECT * From Incidents'+qry,[], (err,rows) => {
        if(rows.length==0){
            res.status(404).type(".txt").send("Error"); 
        }
        else{
            var count=0;
            rows.forEach((row) => {
                var casenumber=row.case_number;
                var date=row.date_time.split('T')[0];
                var time=row.date_time.split('T')[1];
                var code=row.code;
                var incident=row.incident;
                var grid=row.police_grid;
                var neighborhood=row.neighborhood_number;
                var block=row.block;
                if(count<parseInt(limit) && date>=start_date.toString() && date<=end_date.toString()){
                data.push({case_number: casenumber, date: date, time: time, code: code, incident: incident, police_grid: grid, neighborhood_number: neighborhood, block: block});
                count=count+1;
                }
            });
            console.log(data);
            res.status(200).type('json').send(data);
        }
    });
});

// REST API: PUT /new-incident
// Respond with 'success' or 'error'
app.put('/new-incident', (req, res) => {
    let url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    let case_number=url.searchParams.get('case_number');
    let date=url.searchParams.get('date');
    let time=url.searchParams.get('time');
    let code=url.searchParams.get('code');
    let incident=url.searchParams.get('incident');
    let police_grid=url.searchParams.get('police_grid');
    let neighborhood_number=url.searchParams.get('neighborhood_number');
    let block=url.searchParams.get('block');
    let exists=false;


    db.all('SELECT * From Incidents',[], (err,rows) => {
        if(rows.length==0){
            res.status(404).type(".txt").send("Error"); 
        }
        else{
            rows.forEach((row) => {
                if(case_number==row.case_number) {exists=true;}
                });
            }
        });

    if(exists){
        res.status(500).type('txt').send('error: case with case_number=' + case_number + ' already exists');
    }
    else{
        let new_case={
            case_number: case_number,
            date: date,
            time: time,
            code: code,
            incident: incident,
            police_grid: police_grid,
            neighborhood_number: neighborhood_number,
            block: block
        };
        db.run("INSERT INTO Incidents(casenumber,date,time,code,incident,police_grid,neighborhood_number,block VALUES("+new_case.toString()+")");
        res.status(200).type('txt').send('success');
    }
});


// Create Promise for SQLite3 database SELECT query 
function databaseSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        })
    })
}

// Create Promise for SQLite3 database INSERT query
function databaseInsert(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}


// Start server
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
