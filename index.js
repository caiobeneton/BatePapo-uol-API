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

app.get("/messages", async (req, res) => {
    const limit = Number(req.query.limit)
    const user = req.headers.user

    try {
        const messages = await db.collection("messages").find().toArray()

        const filtered = messages.filter((m) => {
            if (m.type === "message" || m.type === "status" || m.to === user || m.from === user) {
                return m
            }
        }).slice(-limit)

        res.send(filtered)
    } catch (err) {
        res.sendStatus(500)
    }
})

app.post("/status", async (req, res) => {
    const user = req.headers.user
    const checkUser = await db.collection("participants").findOne({user})

    if (!checkUser) {
        res.sendStatus(404)
        return
    }

    try {
        await db.collection("participants").updateOne({user}, {$set: {lastStatus: Date.now()}})

        res.sendStatus(200)
    } catch (err) {
        res.sendStatus(500)
    }
})

async function removeInactive() {
    const users = await db.collection("participants").find().toArray()

    const inactive = users.filter((us) => {
        if (Date.now() - us.lastStatus > 10000) {
            return us
        }
    })

    inactive.forEach( async (user) => {
        try {
            await db.collection("participants").deleteOne({name: user.name})

            const statusMsg = {
                from: user.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs(Date.now().format("HH:mm:ss"))
            }

            await db.collection("messages").insertOne(statusMsg)
        } catch (err) {
            console.log(err)
        }
    })
}

setInterval(removeInactive, 15000)

app.listen(5000, () => {
    console.log("Server running in port 5000")
})