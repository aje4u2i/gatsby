const fs = require(`fs`)
const { join, dirname } = require(`path`)

// Traverse is a es6 module...
import traverse from 'babel-traverse'
const babylon = require(`babylon`)
const types = require(`babel-types`)
const Promise = require(`bluebird`)
const _ = require(`lodash`)

const apiRunnerNode = require(`../utils/api-runner-node`)
const { getGraphQLTag } = require(`../utils/babel-plugin-extract-graphql`)

const readFileAsync = Promise.promisify(fs.readFile)

function getAssignedIdenifier(path) {
  let property = path.parentPath
  while (property) {
    if (types.isVariableDeclarator(property)) {
      return property.node.id.name
    }
    property = property.parentPath
  }
}

function getQuery(filePath) {
  // we want to avoid the cache!
  delete require.cache[require.resolve(filePath)]
  return require(filePath).text
}

function extractQueries(ast, filePath) {
  let queries = {}
  traverse(ast, {
    ExportNamedDeclaration(path, state) {
      path.traverse({
        TaggedTemplateExpression(innerPath) {
          const ast = getGraphQLTag(innerPath)
          if (ast) {
            const mainDefinition = ast.definitions[0]

            if (
              mainDefinition.kind !== `OperationDefinition` ||
              mainDefinition.operation !== `query`
            )
              return

            const queryPath = join(
              dirname(filePath),
              `./__generated__/${mainDefinition.name.value}.graphql.js`
            )

            queries[getAssignedIdenifier(innerPath)] = _.trim(
              getQuery(queryPath)
            )
          }
        },
      })
    },
  })
  console.log(queries)
  return queries
}

module.exports = async filePath => {
  let fileStr = await readFileAsync(filePath, `utf-8`)
  let ast
  // Preprocess and attempt to parse source; return an AST if we can, log an
  // error if we can't.
  const transpiled = await apiRunnerNode(`preprocessSource`, {
    filename: filePath,
    contents: fileStr,
  })
  if (transpiled.length) {
    for (const item of transpiled) {
      try {
        const tmp = babylon.parse(item, {
          sourceType: `module`,
          plugins: [`*`],
        })
        ast = tmp
        break
      } catch (e) {
        console.info(e)
        continue
      }
    }
    if (ast === undefined) {
      console.error(`Failed to parse preprocessed file ${filePath}`)
    }
  } else {
    try {
      ast = babylon.parse(fileStr, {
        sourceType: `module`,
        sourceFilename: true,
        plugins: [`*`],
      })
    } catch (e) {
      console.log(`Failed to parse ${filePath}`)
      console.log(e)
    }
  }

  // TODO: can add support for multiple queries per file
  const queries = extractQueries(ast, filePath)
  return queries.pageQuery
}
