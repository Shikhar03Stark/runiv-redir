
module.exports = {
  development: {
    username: "postgres",
    password: "postgres",
    database: "runiv_development",
    host: "127.0.0.1",
    dialect: "postgres",
  },

  test: {
    username: "postgres",
    password: "postgres",
    database: "runiv_test",
    host: "127.0.0.1",
    dialect: "postgres",
  },

  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'runiv',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
  }
}
