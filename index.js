var sqlite3 = require('sqlite3').verbose();
var fs = require('fs');
var request = require('request');
var moment = require('moment');
var cron = require('node-cron');
var exec = require('child_process').exec;
var async = require('async');
/*

THE CODE IS SOOOO DIRTY, BUT I NEED THE DATA NOT CLEAN CODE
*/

/*
- Diseñar BD
- LLamada api
- guardar datos
- hacerlo npm task para que se ejecute periodicamente
- tests
*/
//var start = Date.now();

var db = new sqlite3.Database('gas_prices.db');
var today = new moment().format("DD/MM/YYYY");
async.waterfall([
	createDbPrices,
	createDb,
	function (callback) {
		var alreadyChecked = false;
		db.each("SELECT date as dd FROM gas_last WHERE num = 1", function (err, row) {
			if (err) throw err;
			if (row == undefined) return;
			alreadyChecked = (row['dd'] == today)
		}, function () {
			if (alreadyChecked)
				callback('Already Checked ');
			else
				callback(null);
		});
	},
	requestGasData,
], function (err, result) {
	if (err) {		
		sendMail(err + today);
		process.exit(1);
		//throw err;
	} else {
		console.log(result);
		sendMail(result + today);
	}
});
/*cron.schedule('* * * * *', function () {
	createDb(db);
	requestGasData(db);
});*/

function requestGasData(callback) {
	var options = {
		url: 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
		method: 'GET',
		headers: {
			'Accept': 'application/json, text/plain, */*'
		}
	};
	request(options, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var gasData = cleanUpResponse(JSON.parse(body));
			if (gasData.ListaEESSPrecio.length <= 0) {
				console.log("ERROR.");
				return;
			}
			var todayDate = new moment(gasData['Fecha'], 'DD/MM/YYYY').unix();
			insertDataToDb(db, gasData.ListaEESSPrecio, todayDate);
			console.log('Number of Fuel Stations parsed: ' + gasData.ListaEESSPrecio.length);
			responseToFile(gasData);
			db.close(function () {
				//console.log("Total time: " + (Date.now() - start) + "ms");
				allCompleted(callback);
			});
		} else {
			//sendMail('ERROR (L46): ' + gasData['Fecha']);
			callback('ERROR request ');
		}
	});
}
function insertDataToDb(db, rows, todayDate) {
	db.serialize(function () {
		rowsSinceLastCommit = 0;
		var stmt;
		rows.forEach(function callback(row, index, array) {
			if (rowsSinceLastCommit == 0) {
				db.run("begin transaction");
				stmt = db.prepare(`INSERT OR IGNORE INTO gas_data(
		'c_p', 'address', 'city', 'latitude', 'longitude', 'diesel_price', 'new_diesel_price',
		'province', 'ideess', 'idmunicipio', 'idprovincia', 'idccaa', 'date') VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
			}
			stmt.run(
				row['C.P.'],
				row['Dirección'],
				row['Localidad'],
				row['Latitud'] == null ? null : parseFloat(row['Latitud'].replace(',', '.').replace(' ', '')),
				row['Longitud (WGS84)'] == null ? null : parseFloat(row['Longitud (WGS84)'].replace(',', '.').replace(' ', '')),
				row['Precio Gasoleo A'] == null ? null : parseFloat(row['Precio Gasoleo A'].replace(',', '.').replace(' ', '')),
				row['Precio Nuevo Gasoleo A'] == null ? null : parseFloat(row['Precio Nuevo Gasoleo A'].replace(',', '.').replace(' ', '')),
				row['Provincia'],
				row['IDEESS'],
				row['IDMunicipio'],
				row['IDProvincia'],
				row['IDCCAA'],
				todayDate);
			rowsSinceLastCommit++;
			if (rowsSinceLastCommit >= 1200) {
				db.run("commit");
				rowsSinceLastCommit = 0;
			}
		});
		if (rowsSinceLastCommit > 0)
			db.run("commit");
		/*db.each("SELECT rowid AS id, info FROM lorem", function (err, row) {
			console.log(row.id + ": " + row.info);
		});*/
	});
}
function createDbPrices(callback) {
	db.run("CREATE TABLE IF NOT EXISTS  `gas_data` ("
		+ "`c_p`	TEXT,"
		+ "`address`	TEXT,"
		+ "`city`	TEXT,"
		+ "`latitude`	REAL,"
		+ "`longitude`	REAL,"
		+ "`diesel_price`	REAL,"
		+ "`new_diesel_price`	REAL,"
		+ "`province`	TEXT,"
		+ "`ideess`	INTEGER,"
		+ "`idmunicipio`	INTEGER,"
		+ "`idprovincia`	INTEGER,"
		+ "`idccaa`	INTEGER,"
		+ "`date`	INTEGER NOT NULL,"
		+ "PRIMARY KEY(`ideess`,`date`));", callback);
}
function createDb(callback) {
	db.run("CREATE TABLE IF NOT EXISTS  `gas_last` ("
		+ "`num`	INTEGER,"
		+ "`date`	TEXT,"
		+ "PRIMARY KEY(`num`));", callback);

}

function responseToFile(response) {
	fs.writeFile('last_data.json', JSON.stringify(response, null, 4));
}

function cleanUpResponse(response) {
	var pricesData = response.ListaEESSPrecio.filter(function (ele) {
		return (ele != null && ele != 1);
	});
	response.ListaEESSPrecio = pricesData;
	return response;
}

function sendMail(body) {
	exec('echo ' + body + ' | mailx -s "GAS_PRICES" gonzalo.hernandez.1293@gmail.com', function (error, stdout, stderr) { });
}

function allCompleted(callback) {
	db.serialize(function () {
		var stmt = db.prepare("INSERT INTO gas_last VALUES (?,?)");
		stmt.run(1, today);
		stmt.finalize();
	});
	callback(null, 'OK ');
}
