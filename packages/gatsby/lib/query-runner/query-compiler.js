// @flow
import path from "path"
import glob from "glob"
import Bluebird from "bluebird"
import { FileIRParser, IRTransforms } from "relay-compiler"
import ASTConvert from "relay-compiler/lib/ASTConvert"
import RelayPrinter from "relay-compiler/lib/RelayPrinter"
import RelayCompilerContext from "relay-compiler/lib/RelayCompilerContext"
import filterContextForNode from "relay-compiler/lib/filterContextForNode"
import { store } from "../redux"

import type { GraphQLSchema } from "graphql"
import type FileParser from "relay-compiler/lib/FileParser"

const { printTransforms } = IRTransforms
const globp = Bluebird.promisify(glob)

const {
  ArgumentsOfCorrectTypeRule,
  DefaultValuesOfCorrectTypeRule,
  FragmentsOnCompositeTypesRule,
  KnownTypeNamesRule,
  LoneAnonymousOperationRule,
  PossibleFragmentSpreadsRule,
  ScalarLeafsRule,
  VariablesAreInputTypesRule,
  VariablesInAllowedPositionRule,
} = require("graphql")

type RootQuery = {
  name: string,
  path: string,
  text: string,
}

class Runner {
  baseDir: string
  schema: GraphQLSchema
  parser: FileParser

  constructor(baseDir: string, schema: GraphQLSchema) {
    this.baseDir = baseDir
    this.schema = schema
    this.parser = FileIRParser.getParser(baseDir)
  }

  async compileAll() {
    await this.parseEverything()
    return this.write()
  }

  async parseEverything() {
    let files = await globp(`${this.baseDir}/**/*.js`)

    await this.parser.parseFiles(files.map(f => path.relative(this.baseDir, f)))
  }

  async write() {
    const namePathMap: Map<string, string> = new Map()
    const documents = []

    this.parser.documents().forEach((doc, filePath) => {
      documents.push(doc)
      doc.definitions.forEach(({ name }) => {
        namePathMap.set(name.value, filePath)
      })
    })

    let compilerContext = new RelayCompilerContext(this.schema)
    compilerContext = compilerContext.addAll(
      ASTConvert.convertASTDocuments(this.schema, documents, [
        ArgumentsOfCorrectTypeRule,
        DefaultValuesOfCorrectTypeRule,
        FragmentsOnCompositeTypesRule,
        KnownTypeNamesRule,
        LoneAnonymousOperationRule,
        PossibleFragmentSpreadsRule,
        ScalarLeafsRule,
        VariablesAreInputTypesRule,
        VariablesInAllowedPositionRule,
      ])
    )

    const printContext = printTransforms.reduce(
      (ctx, transform) => transform(ctx, this.schema),
      compilerContext
    )

    const compiledNodes: Map<string, RootQuery[]> = new Map()

    compilerContext.documents().forEach((node: { name: string }) => {
      if (node.kind !== "Root") return

      const { name } = node
      let filePath = path.join(this.baseDir, namePathMap.get(name) || "")
      let current = compiledNodes.get(filePath) || []

      compiledNodes.set(filePath, [
        ...current,
        {
          name,
          path: path.join(this.baseDir, filePath),
          text: filterContextForNode(printContext.getRoot(name), printContext)
            .documents()
            .map(RelayPrinter.print)
            .join("\n"),
        },
      ])
    })

    return compiledNodes
  }
}

export default function compile(): Promise<Map<string, RootQuery[]>> {
  const { program, schema } = store.getState()

  const runner = new Runner(`${program.directory}/src`, schema)

  return runner.compileAll()
}
