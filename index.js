const MongoClient = require('mongodb').MongoClient;
const express = require('express');
const express_graphql = require('express-graphql');
const jwt = require('express-jwt');
const jsonwebtoken = require('jsonwebtoken');
const { GraphQLBoolean, GraphQLNonNull, GraphQLSchema, GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLString } = require('graphql');
const cors = require('cors');


const JWT_SECRET = 'dev_secret_enough';
const DB_NAME = 'merkez';

const CourseType = new GraphQLObjectType({
    name: 'Course',
    fields: {
        id: { type: GraphQLInt },
        title: { type: GraphQLString },
        author: { type: GraphQLString },
        description: { type: GraphQLString },
        topic: { type: GraphQLString },
        url: { type: GraphQLString },
        calc: {type: GraphQLString,
            args: {upperCase: { type: GraphQLBoolean }  },
            resolve: (obj, args) => {
                const calc = `${obj.title} ==> ${obj.topic}`;
                return args.upperCase ? calc.toLocaleUpperCase() : calc;
                }
            }
    }
});

const queryType = new GraphQLObjectType({
    name: 'RootQuery',
    fields: {
        login: {
            type: GraphQLString,
            args: {
                username: {
                    type: GraphQLNonNull(GraphQLString)
                },
                password: {
                    type: GraphQLNonNull(GraphQLString)
                }
            },
            resolve: (_, args) => login(args)
        },
        course: {
            description: 'course açıklaması',
            type: CourseType,
            args: {
                id: {
                    type: GraphQLNonNull(GraphQLInt)
                }
            },
            resolve: (obj, args, context, info) => course(args, context)
        },
        courses: {
            description: 'courses açıklaması',
            type:  new GraphQLList(CourseType),
            args: {
                topic: {
                    type: GraphQLString
                }
            },
            resolve: (obj, args, context) => courses(args, context)
        }
	}
});

const mutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
        updateCourseTopic: {
            description: 'updateCourseTopic açıklaması',
            type: CourseType,
            args: {
                id: {
                    type: GraphQLInt
                },
                topic: {
                    type: GraphQLString
                }
            },
            resolve: (_, args) => updateCourseTopic(args)
        }
	}
});

const schema = new GraphQLSchema({
    query: queryType,
	mutation: mutationType
});

function login(args) {
    const {username, password} = args;
    if (username === 'soner' && password === '1') {
        return jsonwebtoken.sign({ sub: 'soner', auth: ['USER','ADMIN'] }, JWT_SECRET, { expiresIn: '7d' });
    }
}

function yetkiKontrol(context, role) {
    if (!context.user) throw new Error('Login olmalısınız..');
    if (!context.user.auth) throw new Error('Hiç yetkiniz yok.');
    if (!context.user.auth.includes(role)) throw new Error('Yetkiniz yeterli değil.');
}

function course(args, context) {
    yetkiKontrol(context, 'USER');

    const {id} = args;
    return new Promise((resolve, reject)=>{
		global.client.db('merkez').collection('kurs').findOne({id})
			.then(res => {
				resolve(res);
			})
			.catch(err => reject(err) );		
	});
}

function courses({args, context}) {
    yetkiKontrol(context, 'USER');

    const {topic} = args;
    return new Promise((resolve, reject)=>{
    if (topic) {
        global.client.db(DB_NAME).collection('kurs').find({topic}).toArray()
            .then(results => {
                resolve(results);
            })
            .catch(err => reject(err) );
    } else {
		global.client.db(DB_NAME).collection('kurs').find().toArray()
			.then(results => {
				resolve(results);
			})
			.catch(err => reject(err) );		
    }
	});
}

function updateCourseTopic({id, topic}) {
    return new Promise((resolve, reject)=>{
		global.client.db(DB_NAME).collection('kurs').findOneAndUpdate({id}, {$set: {topic}})
			.then(res => {
				global.client.db(DB_NAME).collection('kurs').findOne({id})
					.then(last => {
						resolve(last);
					})
					.catch(err => reject(err) );
			})
			.catch(err => reject(err) );
	});
}

const auth = jwt({
    secret: JWT_SECRET,
    credentialsRequired: false
});

const app = express();
app.use(cors());

app.use('/graphql', auth, express_graphql(req => ({
    schema,
    context: {
        user: req.user
    }
})));

MongoClient.connect('mongodb://node:node12@ds143614.mlab.com:43614/merkez', { useNewUrlParser: true }, function (err, client) {
    if(err) throw err;
    global.client = client;

    // start server
    var port = process.env.PORT || 4000;
    app.listen(port, '0.0.0.0', () => console.log('Express GraphQL Server Now Running On localhost:'+port+'/graphql'));
});
