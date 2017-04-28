import { graphql } from "graphql"
import { introspectionQuery, printSchema } from "graphql/utilities"
import mkdirp from "mkdirp"
import path from "path"
import fse from "fs-extra"
import Promise from "bluebird"
const { store } = require("../redux")

const fs = Promise.promisifyAll(fse)

mkdirp.sync(path.join(__dirname, "../data"))

async function writeJson(schema) {
  const { program } = store.getState()

  const result = await graphql(schema, introspectionQuery)
  if (result.errors) throw new Error(result.errors)

  await fs.writeFileSync(
    `${program.directory}/.cache/schema.json`,
    JSON.stringify(result, null, 4)
  )
}

module.exports = function writeSchema(schema) {
  const { program } = store.getState()

  return Promise.all([
    fs.writeFileSync(
      `${program.directory}/.cache/schema.graphql`,
      printSchema(schema)
    ),
    writeJson(schema),
  ])
}
