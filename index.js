import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

const userSchema = joi.object({
    name: joi.string().trim().required(),
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid("message", "private_message"),
});

const app = express();

dotenv.config();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
    await mongoClient.connect()
    db = mongoClient.db("batePapoUol")
} catch (err) {
    console.log(err)
}

app.post("/participants", async (req, res) => {
    const { name } = req.body
    const validation = userSchema.validate(req.body, { abortEarly: false })

    if (validation.error) {
        console.log(validation.error.details)
        res.sendStatus(422)
        return
    }

    const newUser = {
        name,
        lastStatus: Date.now()
    }

    const statusMsg = {
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(newUser.lastStatus).format("HH:mm:ss")
    }

    try {
        const userExists = await db.collection("participants").findOne({name})
        if (userExists) {
            res.sendStatus(409)
            return
        }

        await db.collection("participants").insertOne(newUser)
        await db.collection("messages").insertOne(statusMsg)
        res.sendStatus(201)
    } catch (err) {
        res.sendStatus(500)
    }
})

app.get("/participants", async (req, res) => {
    try {
        const users = await db.collection("participants").find().toArray()
        res.send(users)
    } catch (err) {
        res.sendStatus(500)
    }
})

app.post("/messages", async (req, res) => {
    const {to, text, type} = req.body
    const from = req.headers.user
    const validation = messageSchema.validate(req.body, {abortEarly: false})

    if (validation.error) {
        res.sendStatus(422)
        return
    }

    const message = {
        from,
        to,
        text,
        type,
        time: dayjs(Date.now().format("HH:mm:ss"))
    }

    try {
        const checkUser = await db.collection("participants").findOne({name: from})

        if (!checkUser) {
            res.sendStatus(422)
            return
        }

        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
    } catch (err) {
        res.sendStatus(500)
    }
})

app.listen(5000, () => {
    console.log("Server running in port 5000")
})