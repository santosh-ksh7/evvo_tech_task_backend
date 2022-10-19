import  express from 'express';
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {auth} from "./cutom_middleware/auth.js"


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


// const mongo_url = "mongodb://127.0.0.1";
const mongo_url = process.env.mongo_url;


async function createConnection(){
  const client = new MongoClient(mongo_url);
  await client.connect();
  console.log("MongoDB is connected");
  return client;
}

async function generateHash(pwd){
  const salt = await bcrypt.genSalt(5);
  const hash = await bcrypt.hash(pwd, salt);
  return hash;
}


const client = await createConnection();


app.get('/', function (req, res) {
  res.send('Hello World')
})


// API to create new account for user
app.post("/create-account", async function(req, res){
  const info_from_frontend = req.body;
  // Before entering the data making sure no other user with same email doesn't exist
  const find_existing_user = await client.db("evo_tech").collection("users").findOne({email: info_from_frontend.email});
  if(find_existing_user){
    res.send({msg: "email id is already registered. Kindly use a different email id"})
  }else{
    const hash_pwd = await generateHash(info_from_frontend.pwd);
    const data2enter= {
      ...info_from_frontend,
      pwd: hash_pwd,
      re_pwd: hash_pwd,
      sick_leave: 4,
      casual_leave: 2,
      earned_leave: 0,
      total_no_of_leaves: 25,
      total_no_of_availed_leaves: 6,
      balance: 19
    }
    const db_insert = await client.db("evo_tech").collection("users").insertOne(data2enter);
    if(db_insert.insertedId){
      res.send({msg: "New user succesfully created"})
    }else{
      res.send({msg: "The user can't be created. Try again"})
    }
  }
})





// API for login
app.post("/login", async function(req,res){
  const data_from_frontend = req.body;
  // First step is to check whether the email id is registered wqith us or not
  const find_in_db = await client.db("evo_tech").collection("users").findOne({email: data_from_frontend.email});
  if(find_in_db){
    // Now check whether the paswword the user enters matches with the password hash value stored in db
    const pwd_check = await bcrypt.compare(data_from_frontend.pwd, find_in_db.pwd);
    if(pwd_check){
      const token = jwt.sign({_id: find_in_db.email}, process.env.secret_key);
      res.send({msg: "Succesfully logged in", token, uuid: find_in_db._id})
    }else{
      res.send({msg: "Invalid Credentials"})
    }
  }else{
    res.send({msg: "Invalid Credentials"})
  }
})



// API to validate email to reset password
app.post("/reset-pwd1", async function(req, res){
  const data_from_frontend = req.body;
  // Validate whetehr this email is registered with us or not
  const find_in_db = await client.db("evo_tech").collection("users").findOne({email: data_from_frontend.email});
  if(find_in_db){
    res.send({msg: "email is registered. Moving to next step", email: find_in_db.email})
  }else{
    res.send({msg: "email is not registered. Make sure the email is registered with us"})
  }
})


// API to update the credentials for reset password flow
app.post("/reset-pwd2", async function(req, res){
  const data_from_frontend = req.body;
  const hashvalue = await generateHash(data_from_frontend.new_pwd);
  // Now identify which user we have to update
  const find_in_db_and_update = await client.db("evo_tech").collection("users").updateOne({email: data_from_frontend.email}, {$set: {pwd: hashvalue, re_pwd: hashvalue}});
  if(find_in_db_and_update.modifiedCount === 1){
    res.send({msg: "Password is succesfully updated"});
  }else{
    res.send({msg: "Password can't be updated"});
  }
})


// API to get the employee details
app.get("/get-user-data/:id", auth ,async function(req, res){
  const{id} = req.params;
  const find_in_db = await client.db("evo_tech").collection("users").findOne({_id: ObjectId(id)});
  if(find_in_db){
    res.send(find_in_db);
  }else{
    res.send({msg: "Couldn't fetch the employee data"});
  }
})


// API to apply for a leave
app.post("/create-a-leave" , auth,  async function(req,res){
  const data_from_frontend = req.body;
  const data2insert = {
    ...data_from_frontend,
    user_id: ObjectId(data_from_frontend.user_id)
  }
  const insert_to_db = await client.db("evo_tech").collection("leaves").insertOne(data2insert);

  // Update the user record for different leave field for different scenarios
  if(data_from_frontend.leave_type === "sick_leave"){
    // Get employee details before applying for a leave
    const get_user_current_status = await client.db("evo_tech").collection("users").findOne({_id: ObjectId(data_from_frontend.user_id)})
    // Now upadte the users different fields for leave application (like sick leave, casual leave, total no. of availed leaves, balance, etc)
    const data_to_update = await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data_from_frontend.user_id)}, {$set: {sick_leave : get_user_current_status.sick_leave + data_from_frontend.duration, total_no_of_availed_leaves: get_user_current_status.total_no_of_availed_leaves + data_from_frontend.duration, 
    balance: get_user_current_status.balance - data_from_frontend.duration}})
  }

  else if(data_from_frontend.leave_type === "casual_leave" ){
    // Get employee details before applying for a leave
    const get_user_current_status = await client.db("evo_tech").collection("users").findOne({_id: ObjectId(data_from_frontend.user_id)})
    // Now upadte the users different fields for leave application (like sick leave, casual leave, total no. of availed leaves, balance, etc)
    const data_to_update = await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data_from_frontend.user_id)}, {$set: {casual_leave : get_user_current_status.casual_leave + data_from_frontend.duration, total_no_of_availed_leaves: get_user_current_status.total_no_of_availed_leaves + data_from_frontend.duration, 
    balance: get_user_current_status.balance - data_from_frontend.duration}})
  }
  
  else if(data_from_frontend.leave_type === "earned_leave"){
    // Get employee details before applying for a leave
    const get_user_current_status = await client.db("evo_tech").collection("users").findOne({_id: ObjectId(data_from_frontend.user_id)})
    // Now upadte the users different fields for leave application (like sick leave, casual leave, total no. of availed leaves, balance, etc)
    const data_to_update = await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data_from_frontend.user_id)}, {$set: {earned_leave : get_user_current_status.earned_leave + data_from_frontend.duration, total_no_of_availed_leaves: get_user_current_status.total_no_of_availed_leaves + data_from_frontend.duration, 
    balance: get_user_current_status.balance - data_from_frontend.duration}})
  }

  if(insert_to_db.insertedId){
    res.send({msg: "Succesfully drafted a leave"})
  }else{
    res.send({msg: "Unable to draft a leave application. Please try again later."})
  }
})




// API to get all applied leaves
app.get("/all-leaves-applied/:id" , auth, async function(req, res){
  const{id} = req.params;
  const find_all_leaves = await client.db("evo_tech").collection("leaves").find({user_id: ObjectId(id)}).toArray();
  res.send(find_all_leaves)
})


// API to delete a applied leave
app.post("/delete-a-leave-application", auth, async function(req, res){
  const data_from_frontend = req.body;

  // Get user current status
  const current_status = await client.db("evo_tech").collection("users").findOne({_id: ObjectId(data_from_frontend.user_id)})

  // Update the user leave fields as per the leave type
  if(data_from_frontend.leave_type === "sick_leave"){
    const update_user_fields = await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data_from_frontend.user_id)}, {$set: {sick_leave: current_status.sick_leave - data_from_frontend.duration, 
      total_no_of_availed_leaves: current_status.total_no_of_availed_leaves - data_from_frontend.duration, 
      balance: current_status.balance + data_from_frontend.duration  }})
  }
  else if(data_from_frontend.leave_type === "casual_leave"){
    const update_user_fields = await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data_from_frontend.user_id)}, {$set: {casual_leave: current_status.casual_leave - data_from_frontend.duration, 
      total_no_of_availed_leaves: current_status.total_no_of_availed_leaves - data_from_frontend.duration, 
      balance: current_status.balance + data_from_frontend.duration  }})
  }
  else if(data_from_frontend.leave_type === "earned_leave"){
    const update_user_fields = await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data_from_frontend.user_id)}, {$set: {earned_leave: current_status.earned_leave - data_from_frontend.duration, 
      total_no_of_availed_leaves: current_status.total_no_of_availed_leaves - data_from_frontend.duration, 
      balance: current_status.balance + data_from_frontend.duration  }})
  }

  // Now delete the leave application
  const delete_leave = await client.db("evo_tech").collection("leaves").deleteOne({_id: ObjectId(data_from_frontend._id)})

  // Now in the response send the updated leave application by the users
  const data2send = await client.db("evo_tech").collection("leaves").find({user_id: ObjectId(data_from_frontend.user_id)}).toArray();

  res.send(data2send);
})





// API to get prefilled data for editing an applied leave application
app.get("/get-applied-form-data/:id", auth,  async function(req,res){
  const{id} = req.params;
  const data2send = await client.db("evo_tech").collection("leaves").findOne({_id: ObjectId(id)});
  res.send(data2send);
})



// API to update an existing leave application
app.post("/edit-a-existing-leave-application", auth, async function(req,res){
  const data = req.body;
  // Current status of user
  const current_status = await client.db("evo_tech").collection("users").findOne({_id: ObjectId(data.user_id)})
  // Update the user leave fiels according to the leave type
  if(data.updated_data.leave_type === "casual_leave"){
    // Now to alter the leave duration fields we need a comparision with newer duration of leave & older duration of leave or are equal
    if(data.new_duration > data.old_data.duration){
      const diff = data.new_duration - data.old_data.duration
      await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data.user_id)}, {$set: {casual_leave: current_status.casual_leave + diff, total_no_of_availed_leaves: current_status.total_no_of_availed_leaves + diff, balance: current_status.balance - diff }})
    }
    else if(data.new_duration < data.old_data.duration){
      const diff =  data.old_data.duration - data.new_duration
      await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data.user_id)}, {$set: {casual_leave: current_status.casual_leave - diff, total_no_of_availed_leaves: current_status.total_no_of_availed_leaves - diff, balance: current_status.balance + diff }})
    }
  }
  else if(data.updated_data.leave_type === "sick_leave"){
    // Now to alter the leave duration fields we need a comparision with newer duration of leave & older duration of leave or are equal
    if(data.new_duration > data.old_data.duration){
      const diff = data.new_duration - data.old_data.duration
      await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data.user_id)}, {$set: {sick_leave: current_status.sick_leave + diff, total_no_of_availed_leaves: current_status.total_no_of_availed_leaves + diff, balance: current_status.balance - diff }})
    }
    else if(data.new_duration < data.old_data.duration){
      const diff =  data.old_data.duration - data.new_duration
      await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data.user_id)}, {$set: {sick_leave: current_status.sick_leave - diff, total_no_of_availed_leaves: current_status.total_no_of_availed_leaves - diff, balance: current_status.balance + diff }})
    }
  }
  else if(data.updated_data.leave_type === "earned_leave"){
     // Now to alter the leave duration fields we need a comparision with newer duration of leave & older duration of leave or are equal
     if(data.new_duration > data.old_data.duration){
      const diff = data.new_duration - data.old_data.duration
      await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data.user_id)}, {$set: {earned_leave: current_status.earned_leave + diff, total_no_of_availed_leaves: current_status.total_no_of_availed_leaves + diff, balance: current_status.balance - diff }})
    }
    else if(data.new_duration < data.old_data.duration){
      const diff =  data.old_data.duration - data.new_duration
      await client.db("evo_tech").collection("users").updateOne({_id: ObjectId(data.user_id)}, {$set: {earned_leave: current_status.earned_leave - diff, total_no_of_availed_leaves: current_status.total_no_of_availed_leaves - diff, balance: current_status.balance + diff }})
    }
  }
  // Then update the existing leave with updated data
  await client.db("evo_tech").collection("leaves").updateOne({_id: ObjectId(data.old_data._id)}, {$set:{
    start_date: data.updated_data.start_date, end_date: data.updated_data.end_date, comment: data.updated_data.comment, duration: data.new_duration
  }});
  // Send the response
  res.send({msg: "Succesfully updated all fields & existing leave application"})
})


app.listen(process.env.PORT)