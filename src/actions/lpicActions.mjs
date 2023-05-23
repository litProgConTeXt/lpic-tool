
import yaml from "yaml"

class Requirement {
  constructor(objType, objName) {
    this.objType = objType
    this.objName = objName
  }
}

class Creation {
  constructor(objType, objName) {
    this.objType = objType
    this.objName = objName
  }
}

class BuildArtifact {
  constructor(artifactName, buildType) {
    this.name         = artifactName
    this.type         = buildType
    this.requirements = []
    this.creations    = []
  }

  addRequirement(objType, objName) {
    this.requirements.push(new Requirement(objType, objName))
  }

  addCreation(objType, objName) {
    this.creations.push(new Creation(objType, objName))
  }
}

class BuildReqs {

  buildInfo = {}

  // We place `docName` as the base index to reduce the rare chance of race
  // conditions when working asynchronously
  //

  _getBuildInfo(docName) {
    if (!this.buildInfo[docName]) this.buildInfo[docName] = {}
    if (!this.buildInfo[docName]['artifacts']) this.buildInfo[docName]['artifacts'] = []
    return this.buildInfo[docName]
  }

  startBuildArtifact(docName, buildName, buildType) {
    const theInfo = this._getBuildInfo(docName)
    if (theInfo['curDesc']) {
      const aDesc = theInfo['curDesc']
      theInfo['artifacts'].push(aDesc)
    }
    theInfo['curDesc'] = new BuildArtifact(buildName, buildType)
  }

  stopBuildArtifact(docName, lineNumber) {
    const theInfo = this._getBuildInfo(docName)
    if (!theInfo['curDesc']) {
      console.log(`WARNING: no start of the current artifact build description in ${docName}`)
      console.log(`  ... ignoring the artifact which ends at ${lineNumber}!`)
      return
    }
    const aDesc = theInfo['curDesc']
    theInfo['artifacts'].push(aDesc)
    delete theInfo['curDesc']
  }

  addBuildRequirement(docName, objType, objName, lineNumber) {
    const theInfo = this._getBuildInfo(docName)
    if (!theInfo['curDesc']) {
      console.log(`WARNING: no start of the current artifact build description in ${docName}`)
      console.log(`  ... ignoring the requirement at ${lineNumber}!`)
      return
    }
    theInfo['curDesc'].addRequirement(objType, objName)
  }

  addBuildCreation(docName, objType, objName, lineNumber) {
    const theInfo = this._getBuildInfo(docName)
    if (!theInfo['curDesc']) {
      console.log(`WARNING: no start of the current artifact build description in ${docName}`)
      console.log(`  ... ignoring the creation at ${lineNumber}!`)
      return
    }
    theInfo['curDesc'].addCreation(objType, objName)
  }

  finalize() {
    console.log(yaml.stringify(this))
  }
}

class CodeChunk {
  constructor(startLine, stopLine, theLines, docName) {
    this.startLine = startLine
    this.stopLine  = stopLine
    this.theLines  = theLines
    this.docName   = docName
  }
}

class CodeChunks {
  chunks = {}

  // We place `docName` as the base index to reduce the rare chance of race
  // conditions when working asynchronously
  //
  _getCodeFor(docName, codeType) {
    if (!this.chunks[docName]) this.chunks[docName] = {}
    const docCode = this.chunks[docName]
    if (!docCode[codeType]) docCode[codeType] = {}
    return docCode[codeType]
  }

  startCodeFor(docName, codeType, codeName, lineNumber) {
    const theCode = this._getCodeFor(docName, codeType)
    theCode['codeName'] = codeName
    theCode['start']    = lineNumber
  }

  stopCodeFor(docName, codeType, lineNumber, docLines) {
    const theCode = this._getCodeFor(docName, codeType)

    if (!theCode['start']) {
      console.log(`WARNING: no start of ${codeType} in ${docName}`)
      console.log(`  ... ignoring the chunk that ends at ${lineNumber}!`)
      delete theCode['start']
      delete theCode['codeName']
      return
    }
    const codeName  = theCode['codeName']
    const startLine = theCode['start']
    const stopLine  = lineNumber
    if (stopLine <= startLine) {
      console.log(`WARNING: no ${codeType} found between ${startLine} and ${stopLine} in ${docName}`)
      console.log("  ... ignoring this chuck!")
      delete theCode['start']
      delete theCode['codeName']
      return
    }
    if (!theCode[codeName]) theCode[codeName] = {}
    if (!theCode[codeName]['chunks']) theCode[codeName]['chunks'] = []
    theCode[codeName]['chunks'].push(new CodeChunk(
      startLine, stopLine, docLines.slice(startLine+1, stopLine), docName
    ))
    delete theCode['start']
    delete theCode['codeName']
  }

  finalize() {
    for (const aDocName in this.chunks) {
      for (const aCodeType in this.chunks[aDocName]) {
        console.log(aDocName)
        console.log(aCodeType)
        for (const aCodeName in this.chunks[aDocName][aCodeType]) {
          const chunks = this.chunks[aDocName][aCodeType][aCodeName]['chunks']
          for (const aChunk of chunks) {
            console.log(yaml.stringify(aChunk))
          }
        }
      }
    }    
  }
}

export function registerActions(config, Builders, Grammars, ScopeActions, Structures) {

  Structures.newStructure('code', new CodeChunks())
  Structures.newStructure('build', new BuildReqs())

  function getCodeType(aScope) {
    return aScope.split('.')[4]
  }

  ScopeActions.addScopedAction(
    'keyword.control.source.start.lpic',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      const codeType = theTokens[1]
      const codeName = theTokens[3]
      console.log("----------------------------------------------------------")
      console.log("startCode")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(` codeType: ${codeType}`)
      console.log(` codeName: ${codeName}`)
      console.log(`theTokens: ${theTokens}`)
      console.log(`  theLine: ${theLine}`)
      console.log(`   theDoc: ${theDoc.docName}`)
     console.log("----------------------------------------------------------")
     const code = Structures.getStructure('code')
     code.startCodeFor(theDoc.docName, codeType, codeName, theLine)
    }
  )

  ScopeActions.addScopedAction(
    'keyword.control.source.stop.lpic',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      const codeType = theTokens[1]
      console.log("----------------------------------------------------------")
      console.log("stopCode")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(` codeType: ${codeType}`)
      console.log(`theTokens: ${theTokens}`)
      console.log(`  theLine: ${theLine}`)
      console.log(`   theDoc: ${theDoc.docName}`)
     console.log("----------------------------------------------------------") 
     const code = Structures.getStructure('code')
     code.stopCodeFor(theDoc.docName, codeType, theLine, theDoc.docLines)
   }
  )

  ScopeActions.addScopedAction(
    'finalize.control.source',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      console.log("----------------------------------------------------------")
      console.log("finalizeCode")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(`theTokens: ${theTokens}`)
      //console.log(`  theLine: ${theLine}`)
      //console.log(`   theDoc: ${theDoc.docName}`)
      console.log("----------------------------------------------------------")
      const code = Structures.getStructure('code')
      code.finalize()
    }
  )

  ScopeActions.addScopedAction(
    'keyword.control.description.start.lpic',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      console.log("----------------------------------------------------------")
      console.log("description-start")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(`theTokens: ${theTokens}`)
      console.log(`  theLine: ${theLine}`)
      console.log(`   theDoc: ${theDoc.docName}`)
      console.log("----------------------------------------------------------")      
      const buildName = theTokens[1]
      const buildType = theTokens[3]
      const buildInfo = Structures.getStructure('build')
      buildInfo.startBuildArtifact(theDoc.docName, buildName, buildType)
    }
  )

  ScopeActions.addScopedAction(
    'keyword.control.description.stop.lpic',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      console.log("----------------------------------------------------------")
      console.log("description-stop")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(`theTokens: ${theTokens}`)
      console.log(`  theLine: ${theLine}`)
      console.log(`   theDoc: ${theDoc.docName}`)
     console.log("----------------------------------------------------------")
     const buildInfo = Structures.getStructure('build')
     buildInfo.stopBuildArtifact(theDoc.docName, theLine)
    }
  )

  ScopeActions.addScopedAction(
    'keyword.control.requires.lpic',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      console.log("----------------------------------------------------------")
      console.log("requires")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(`theTokens: ${theTokens}`)
      console.log(`  theLine: ${theLine}`)
      console.log(`   theDoc: ${theDoc.docName}`)
     console.log("----------------------------------------------------------")
     const objectType = theTokens[1]
     const objectName = theTokens[3]
     const buildInfo = Structures.getStructure('build')
     buildInfo.addBuildRequirement(theDoc.docName, objectType, objectName, theLine)
    }
  )

  ScopeActions.addScopedAction(
    'keyword.control.creates.lpic',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      console.log("----------------------------------------------------------")
      console.log("creates")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(`theTokens: ${theTokens}`)
      console.log(`  theLine: ${theLine}`)
      console.log(`   theDoc: ${theDoc.docName}`)
     console.log("----------------------------------------------------------")
     const objectType = theTokens[1]
     const objectName = theTokens[3]
     const buildInfo = Structures.getStructure('build')
     buildInfo.addBuildCreation(theDoc.docName, objectType, objectName, theLine)
    }
  )

  ScopeActions.addScopedAction(
    'finalize.control.description',
    import.meta.url,
    async function(thisScope, theScope, theTokens, theLine, theDoc) {
      console.log("----------------------------------------------------------")
      console.log("finalizeCode")
      console.log(`thisScope: ${thisScope}`)
      console.log(` theScope: ${theScope}`)
      console.log(`theTokens: ${theTokens}`)
      //console.log(`  theLine: ${theLine}`)
      //console.log(`   theDoc: ${theDoc.docName}`)
      console.log("----------------------------------------------------------")
      const buildInfo = Structures.getStructure('build')
      buildInfo.finalize()
    }
  )

}