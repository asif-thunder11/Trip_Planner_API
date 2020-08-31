const express = require('express')
const app = express()

app.use(express.json())

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'thunder',
  database : 'tripdb'
});

connection.connect( (err) => {
	if(err){
		console.log("Error in DB connection")
	}
	else{
		console.log("DB Connected")
	}
});


//handle login
app.post('/login', (req, res)=>{
	let query = `SELECT * FROM user WHERE email='${req.body.email}' AND password='${req.body.password}'`
	console.log("query", query)
	connection.query(query, (err, result)=>{
		if(err){
			console.log('Error while searching user')
			res.status(404).send()
		} else{
			//console.log("Query Result:", result)
			if(result.length==0){
				user = {
					name:null
				}
				console.log("No User Found")
				res.status(200).send(user);		//null user
			} else{
				res.status(200).send(result[0])
				console.log(result[0].name,'Login successfull')
			}
		}
	})
})

//get all trips for requested user
app.post('/getUserTrips', (req, res)=>{
	
	tripItemsList = []

	//get trip details for the given user's travelled trips
	queryGetTrips = "SELECT * FROM (\
		SELECT tr.user_id 'uid', t.id 'trip_id', t.name 'title', tp.title 'trip_package', t.start_date, t.end_date, tp.duration,\
		u.name 'creator', r.start_point 'from', r.end_point 'to'\
		FROM traveller tr LEFT JOIN trip t ON tr.trip_id = t.id\
		LEFT JOIN trip_package tp ON t.trip_package_id = tp.id\
		LEFT JOIN user u ON t.creator_id = u.id\
		INNER JOIN route r ON t.route_id = r.id\
		  ) AS tripList\
		WHERE uid ="+req.body.user_id
	connection.query(queryGetTrips, (err, result)=>{
		if(err){
			console.log("queryGetTripsError: ",err)
		} else{
			console.log("queryGetTrips Successfull")//, result)
		
			genTripItems(result, 0, tripItemsList, res)
		}
	})

		
}) 


//create list of trip items by iterating the result recursively
//recursion to avoid inconsistencies due to async operation
function genTripItems(queryGetTripsResult, i, tripItemsList, response){
	console.log("Item i: ",i)
	currentItem = queryGetTripsResult[i]
	//console.log("currentItem: ",currentItem)
	if(queryGetTripsResult.length==0){
		console.log("No Trips Found")
		response.status(200).send(tripItemsList)
		return
	}
	//getting travelellers
	queryGetTravellers = `SELECT u.name FROM user u WHERE u.id in (SELECT tr.user_id FROM traveller tr WHERE tr.trip_id='${currentItem.trip_id}')`
	connection.query(queryGetTravellers, (err, resultTraveller)=>{
		if(err){
			console.log("Error in queryTraveller: ",err)
			response.status(406).send(req.body)
			return
		}
		else{
			console.log("queryGetTravellers Successfull ")//, resultTraveller)
			
			tr =[]
			resultTraveller.forEach(element => {
				tr.push(element.name)
			});
			currentItem.travellers = tr
			
			queryGetExpenses = `SELECT * FROM(\
				SELECT e.id, t.id 'trip_id', e.name 'name', e.category, e.amount, u.name 'user'\
				FROM expense e LEFT JOIN user u ON e.user_id=u.id\
				LEFT JOIN trip t ON e.trip_id = t.id ORDER BY e.id\
				  ) AS exp WHERE exp.trip_id='${currentItem.trip_id}'`

			connection.query(queryGetExpenses, (err, resultExpense)=>{
				if(err){
					console.log("Error in queryExpense: ", err)
					response.status(406).send(req.body)
					return
				}
				else{
					console.log("queryGetExpense Successful")//, resultExpense)

					currentItem.expenses = resultExpense;

					tripItemsList.push(currentItem)
					if(i==queryGetTripsResult.length-1){
						console.log("Get User Trips Data Successful")
						response.status(200).send(tripItemsList)
					} else{
						genTripItems(queryGetTripsResult, i+1, tripItemsList, response)
					}
				}
			})	
		}
	})
	

}	



//return all users
app.post('/getUsers', (req, res)=>{
	let query = 'SELECT * FROM user';
	connection.query(query, (err, result)=>{
		if(err){
			console.log("queryGetUsers Error: ", err)
		}
		else{
			//console.log(result)
			res.status(200).send(result)
			console.log("queryGetUsers Successfull")//, req.body)
		}
	});
})

//insert a trip record
app.put("/addTrip", (req, res)=>{

	name = req.body.name
	start_date = req.body.start_date
	end_date = req.body.end_date
	creator_id = req.body.creator_id
	route_id = req.body.route_id
	trip_package_id = req.body.trip_package_id


	console.log("Travellers: ", req.body.traveller_ids)
	queryAddTrip = `INSERT INTO trip(name, start_date, end_date, creator_id, route_id, trip_package_id) VALUES('${name}', '${start_date}', '${end_date}', ${creator_id}, ${route_id}, ${trip_package_id})`
	console.log("queryAddTrip: ", queryAddTrip)
	
	connection.query(queryAddTrip, (err, result)=>{
		if(err){
			console.log("queryAddTrip Error: ", err)
			res.status(406).send(err)
			return
		} 
		else{
			console.log("queryAddTrip Success")
			//console.log( "Travellers: ",req.body.traveller_ids)
			
			queryGetTripID = `SELECT id FROM trip WHERE name='${name}'`
			connection.query(queryGetTripID, (err, resultGetTripID)=>{
				if(err){
					console.log("queryGetTripID Error: ", err)//resultGetTripID)
					res.status(406).send(req.body)
					return
				} 
				else{
					
					console.log("queryGetTripID Success ")//, resultGetTripID)
					trip_id = resultGetTripID[0].id

					//array of an array of arrays for INSERTing multiple values
					values = []
					req.body.traveller_ids.forEach(element => {
						values.push( [trip_id, element]  )
					});
					console.log("Values: ", values)
					
					queryAddTravellers = "INSERT INTO traveller(trip_id, user_id) VALUES ?"
					connection.query(queryAddTravellers, [values], (err, result)=>{
						if(err){
							console.log("queryAddTravellers Error: ",err)
							res.status(406).send(req.body)
							return
						} else{
							console.log("queryAddTravellers Success ")
							res.status(200).send(req.body)
						}
					})

				}
			})	
		}
	})
	
})


app.put('/addTraveller', (req, res)=>{

	console.log("Add Traveller Request: ", req.body)
	queryAddTraveller = `INSERT INTO traveller(trip_id, user_id) VALUES(${req.body.trip_id}, ${req.body.user_id})`
	connection.query(queryAddTraveller, (err, result)=>{
		if(err){
			console.log("queryAddTraveller Error: ")
			res.status(406).send(req.body)
			return
		}
		else{
			console.log("queryAddTraveller Success")
			res.status(200).send(req.body)
		}
	})

})

app.put('/addExpense', (req, res)=>{

	console.log("Add Expense Request: ", req.body)
	expense = req.body
	queryAddExpense = `INSERT INTO expense(trip_id, user_id, name, category, amount) VALUES(${expense.trip_id}, ${expense.user_id}, '${expense.name}', '${expense.category}', ${expense.amount})`

	connection.query(queryAddExpense, (err, result)=>{
		if(err){
			console.log("queryAddExpense Error: "+err)
			res.status(406).send(expense)
			return
		}
		else{
			console.log("queryAddExpense Success")
			res.status(200).send(expense)
			return
		}
	})
})


//testing route
app.post('/test', (req, res)=>{
	console.log("Request: ", req.body)
	res.status(200).send(req.body)
})

app.listen(3000, () => {
	console.log("Listening on port 3000...")
})