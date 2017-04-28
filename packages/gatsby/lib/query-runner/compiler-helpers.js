// @flow
import fs from "fs"
import path from "path"
import { FileIRParser, FileWriter, IRTransforms } from "relay-compiler"
import { buildASTSchema, parse } from "graphql"
import { store } from "../redux"

import type { GraphQLSchema } from "graphql"

const {
  codegenTransforms,
  fragmentTransforms,
  printTransforms,
  queryTransforms,
  schemaTransforms,
} = IRTransforms

export const getParser = FileIRParser.getParser

export const getLocations = () => {
  let { program } = store.getState()
  return {
    baseDir: `${program.directory}/src`,
    schema: `${program.directory}/.cache/schema.graphql`,
  }
}

export function getWriter(
  onlyValidate: boolean,
  schema: GraphQLSchema,
  documents: Object,
  baseDocuments: Object
) {
  return new FileWriter({
    config: {
      buildCommand: "relay-compiler-webpack-plugin",
      compilerTransforms: {
        codegenTransforms,
        fragmentTransforms,
        printTransforms,
        queryTransforms,
      },
      baseDir: getLocations().baseDir,
      schemaTransforms,
    },
    onlyValidate,
    schema,
    baseDocuments,
    documents,
  })
}

export function getFileFilter(baseDir: string) {
  return (filename: string) => {
    const fullPath = path.join(baseDir, filename)
    const stats = fs.statSync(fullPath)

    if (stats.isFile()) {
      const text = fs.readFileSync(fullPath, "utf8")
      return text.includes("graphql")
    }

    return false
  }
}

export function getSchema(): GraphQLSchema {
  try {
    return buildASTSchema(
      parse(
        `
          directive @include(if: Boolean) on FRAGMENT | FIELD
          directive @skip(if: Boolean) on FRAGMENT | FIELD
          ${fs.readFileSync(getLocations().schema, "utf8")}
        `
      )
    )
  } catch (error) {
    throw new Error(
      `
Error loading schema. Expected the schema to be a .graphql file using the
GraphQL schema definition language. Error detail:
${error.stack}
    `.trim()
    )
  }
}
