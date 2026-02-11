import {
  Node,
  SourceFile,
  createSourceFile,
  ScriptTarget,
  ScriptKind,
  isTypeNode,
  TypeAliasDeclaration,
  isExpression,
  VariableStatement,
  FunctionDeclaration,
  SyntaxKind,
  Identifier,
  ArrowFunction,
  FunctionExpression,
  InterfaceDeclaration,
  PropertySignature,
  TypeLiteralNode,
  ParameterDeclaration,
  NodeArray,
  TypeElement,
  TypeParameterDeclaration,
  ClassDeclaration,
  MethodDeclaration,
} from "typescript";

class Explorer {
  private tree: Node | null;
  private sourceFile: SourceFile | null;

  constructor(tree: string | Node | null = null) {
    if (tree === null) {
      this.tree = null;
      this.sourceFile = null;
    } else if (typeof tree === "string") {
      const sourceFile = createSourceFile(
        "inline.ts",
        tree,
        ScriptTarget.Latest,
        true,
        ScriptKind.TS,
      );
      this.sourceFile = sourceFile;
      this.tree =
        sourceFile.statements.length === 1
          ? sourceFile.statements[0]
          : sourceFile;
    } else if (Explorer.isNode(tree)) {
      this.tree = tree;
      this.sourceFile =
        typeof tree.getSourceFile === "function" ? tree.getSourceFile() : null;
    } else {
      throw new TypeError(
        "Explorer must be initialized with a string or TS AST node",
      );
    }
  }

  static isNode(value: unknown): value is Node {
    return (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      typeof value.kind === "number"
    );
  }

  isEmpty(): boolean {
    return this.tree === null;
  }

  toString(): string {
    if (this.tree === null) {
      return " no ast";
    }

    return this.tree.getText(this.sourceFile || undefined);
  }

  // Compares the current tree with another code snippet by parsing both and checking their structure
  equals(other: string): boolean {
    if (!this.tree || !other) {
      return this.isEmpty() && other === "";
    }

    const parseComparableCode = (
      text: string,
      referenceNode: Node,
    ): { node: Node; sourceFile: SourceFile } => {
      if (isTypeNode(referenceNode)) {
        const typeFile = createSourceFile(
          "inline.ts",
          `type __T = ${text}`,
          ScriptTarget.Latest,
          true,
          ScriptKind.TS,
        );
        const typeDecl = typeFile.statements[0] as TypeAliasDeclaration;
        return { node: typeDecl.type, sourceFile: typeFile };
      }

      if (isExpression(referenceNode)) {
        const exprFile = createSourceFile(
          "inline.ts",
          `const __v = ${text}`,
          ScriptTarget.Latest,
          true,
          ScriptKind.TS,
        );
        const varDecl = (exprFile.statements[0] as VariableStatement)
          .declarationList.declarations[0];
        return { node: varDecl.initializer!, sourceFile: exprFile };
      }

      if (referenceNode.kind === SyntaxKind.Parameter) {
        const paramFile = createSourceFile(
          "inline.ts",
          `function __f(__p: ${text}) {}`,
          ScriptTarget.Latest,
          true,
          ScriptKind.TS,
        );
        const funcDecl = paramFile.statements[0] as FunctionDeclaration;
        return { node: funcDecl.parameters[0], sourceFile: paramFile };
      }

      throw new Error("Unsupported node type for comparison");
    };

    const expected = parseComparableCode(other, this.tree);

    const compareNodes = (node1: Node, node2: Node): boolean => {
      if (node1.kind !== node2.kind) {
        return false;
      }

      if ("text" in node1 && "text" in node2) {
        if (node1.text !== undefined && node2.text !== undefined) {
          return node1.text === node2.text;
        }
      }

      const children1: Node[] = [];
      const children2: Node[] = [];
      node1.forEachChild((child) => children1.push(child));
      node2.forEachChild((child) => children2.push(child));

      if (children1.length !== children2.length) {
        return false;
      }

      for (let i = 0; i < children1.length; i++) {
        if (!compareNodes(children1[i], children2[i])) {
          return false;
        }
      }

      return true;
    };

    return compareNodes(this.tree, expected.node);
  }

  // Finds all nodes of a specific kind in the current tree
  private findAll(kind: SyntaxKind): Explorer[] {
    const nodes: Explorer[] = [];
    const root = this.tree || this.sourceFile;
    if (!root || !(root as SourceFile).statements) {
      return nodes;
    }

    (root as SourceFile).statements.forEach((statement) => {
      if (statement.kind === kind) {
        nodes.push(new Explorer(statement));
      }
    });
    return nodes;
  }

  // Finds variable statements that are not initialized with functions
  findVariables(): Explorer[] {
    const variables = this.findAll(SyntaxKind.VariableStatement);

    return variables.filter((v) => {
      const declaration = (v.tree as VariableStatement).declarationList
        .declarations[0];
      if (!declaration.initializer) {
        return true;
      }

      const initializerKind = declaration.initializer.kind;
      if (
        initializerKind === SyntaxKind.ArrowFunction ||
        initializerKind === SyntaxKind.FunctionExpression
      ) {
        return false;
      }

      return true;
    });
  }

  // Finds a variable by name, excluding function declarations
  findVariable(name: string): Explorer {
    const variables = this.findVariables();
    const cb = (v: Explorer) =>
      (
        (v.tree as VariableStatement).declarationList.declarations[0]
          .name as Identifier
      ).text === name;
    return variables.find(cb) ?? new Explorer();
  }

  // Checks if a variable with the given name exists in the current tree
  hasVariable(name: string): boolean {
    return !this.findVariable(name).isEmpty();
  }

  // Retrieves the type annotation of a variable statement if it exists, otherwise returns an empty Explorer
  getAnnotation(): Explorer {
    if (!this.tree) {
      return new Explorer();
    }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (declaration.type) {
        return new Explorer(declaration.type);
      }
    }

    return new Explorer();
  }

  hasAnnotation(annotation: string): boolean {
    if (!this.tree) {
      return false;
    }

    // A if ("type" in this.tree &&this.tree.type) {
    //     const typeAnnotation = new Explorer(this.tree.type);
    //     return typeAnnotation.equals(annotation);
    // }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (declaration.type) {
        const typeAnnotation = new Explorer(declaration.type);
        return typeAnnotation.equals(annotation);
      }
    }

    return false;
  }

  // Finds all functions in the current tree, including function declarations, function expressions assigned to variables, and class methods
  findFunctions(): Explorer[] {
    // If tree is a ClassDeclaration, find methods within it
    if (this.tree?.kind === SyntaxKind.ClassDeclaration) {
      const classDecl = this.tree as ClassDeclaration;
      const methods: Explorer[] = [];
      classDecl.members.forEach((member) => {
        if (member.kind === SyntaxKind.MethodDeclaration) {
          methods.push(new Explorer(member));
        }
      });
      return methods;
    }

    const functionDeclarations = this.findAll(SyntaxKind.FunctionDeclaration);
    const variableStatements = this.findAll(SyntaxKind.VariableStatement);
    const functionVariables = variableStatements.filter((v) => {
      const declaration = (v.tree as VariableStatement).declarationList
        .declarations[0];
      if (!declaration.initializer) {
        return false;
      }

      const initializerKind = declaration.initializer.kind;
      return (
        initializerKind === SyntaxKind.ArrowFunction ||
        initializerKind === SyntaxKind.FunctionExpression
      );
    });
    return [...functionDeclarations, ...functionVariables];
  }

  // Finds a function by name, checking function declarations, variable statements with functions, and method declarations
  findFunction(name: string): Explorer {
    const functions = this.findFunctions();
    const cb = (f: Explorer) => {
      if (f.tree?.kind === SyntaxKind.FunctionDeclaration) {
        return (f.tree as FunctionDeclaration).name?.text === name;
      }

      if (f.tree?.kind === SyntaxKind.VariableStatement) {
        const declaration = (f.tree as VariableStatement).declarationList
          .declarations[0];
        return (declaration.name as Identifier).text === name;
      }

      if (f.tree?.kind === SyntaxKind.MethodDeclaration) {
        return ((f.tree as MethodDeclaration).name as Identifier).text === name;
      }
    };

    return functions.find(cb) ?? new Explorer();
  }

  // Checks if a function with the given name exists in the current tree
  hasFunction(name: string): boolean {
    return !this.findFunction(name).isEmpty();
  }

  // Checks if a function (either a function declaration or a variable statement initialized with a function) has a specific return type annotation
  hasReturnAnnotation(annotation: string): boolean {
    if (!this.tree) {
      return false;
    }

    if (this.tree.kind === SyntaxKind.FunctionDeclaration) {
      const funcDecl = this.tree as FunctionDeclaration;
      if (funcDecl.type) {
        const returnAnnotation = new Explorer(funcDecl.type);
        return returnAnnotation.equals(annotation);
      }
    }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (
        declaration.initializer &&
        (declaration.initializer.kind === SyntaxKind.ArrowFunction ||
          declaration.initializer.kind === SyntaxKind.FunctionExpression)
      ) {
        const funcExpr = declaration.initializer as
          | ArrowFunction
          | FunctionExpression;
        if (funcExpr.type) {
          const returnAnnotation = new Explorer(funcExpr.type);
          return returnAnnotation.equals(annotation);
        }
      }
    }

    return false;
  }

  // Retrieves the parameters of a function, whether it's a function declaration or a variable statement initialized with a function
  getParameters(): Explorer[] {
    if (!this.tree) {
      return [];
    }

    if (this.tree.kind === SyntaxKind.FunctionDeclaration) {
      const funcDecl = this.tree as FunctionDeclaration;
      return funcDecl.parameters.map((param) => new Explorer(param));
    }

    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (
        declaration.initializer &&
        (declaration.initializer.kind === SyntaxKind.ArrowFunction ||
          declaration.initializer.kind === SyntaxKind.FunctionExpression)
      ) {
        const funcExpr = declaration.initializer as
          | ArrowFunction
          | FunctionExpression;
        return funcExpr.parameters.map((param) => new Explorer(param));
      }
    }

    return [];
  }

  // Finds all type alias declarations in the current tree
  findTypes(): Explorer[] {
    return this.findAll(SyntaxKind.TypeAliasDeclaration);
  }

  // Finds a type alias declaration by name
  findType(name: string): Explorer {
    const types = this.findTypes();
    const cb = (t: Explorer) =>
      (t.tree as TypeAliasDeclaration).name.text === name;
    return types.find(cb) ?? new Explorer();
  }

  // Checks if a type alias declaration with the given name exists in the current tree
  hasType(name: string): boolean {
    return !this.findType(name).isEmpty();
  }

  // Finds all interface declarations in the current tree
  findInterfaces(): Explorer[] {
    return this.findAll(SyntaxKind.InterfaceDeclaration);
  }

  // Finds an interface declaration by name
  findInterface(name: string): Explorer {
    const interfaces = this.findInterfaces();
    const cb = (i: Explorer) =>
      (i.tree as InterfaceDeclaration).name.text === name;
    return interfaces.find(cb) ?? new Explorer();
  }

  // Checks if an interface declaration with the given name exists in the current tree
  hasInterface(name: string): boolean {
    return !this.findInterface(name).isEmpty();
  }

  // Finds all class declarations in the current tree
  findClasses(): Explorer[] {
    return this.findAll(SyntaxKind.ClassDeclaration);
  }

  // Finds a class declaration by name
  findClass(name: string): Explorer {
    const classes = this.findClasses();
    const cb = (c: Explorer) =>
      (c.tree as ClassDeclaration).name?.text === name;
    return classes.find(cb) ?? new Explorer();
  }

  // Checks if a class declaration with the given name exists in the current tree
  hasClass(name: string): boolean {
    return !this.findClass(name).isEmpty();
  }

  // Checks if a property with the given name (and optionally type and optionality) exists in the current tree, which can be an interface, type literal, or variable statement with a type literal annotation
  hasProp(name: string, type?: string, isOptional?: boolean): boolean {
    if (!this.tree) {
      return false;
    }

    let members: NodeArray<TypeElement> | undefined;

    // Handle VariableStatement with TypeLiteral annotation
    if (this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      if (
        declaration.type &&
        declaration.type.kind === SyntaxKind.TypeLiteral
      ) {
        members = (declaration.type as TypeLiteralNode).members;
      }
    }

    // Handle InterfaceDeclaration
    if (!members && this.tree.kind === SyntaxKind.InterfaceDeclaration) {
      members = (this.tree as InterfaceDeclaration).members;
    }

    // Handle TypeAliasDeclaration with TypeLiteral
    if (!members && this.tree.kind === SyntaxKind.TypeAliasDeclaration) {
      const typeAlias = this.tree as TypeAliasDeclaration;
      if (typeAlias.type.kind === SyntaxKind.TypeLiteral) {
        members = (typeAlias.type as TypeLiteralNode).members;
      }
    }

    // Handle TypeLiteral directly
    if (!members && this.tree.kind === SyntaxKind.TypeLiteral) {
      members = (this.tree as TypeLiteralNode).members;
    }

    // Handle Parameter (for destructured parameters)
    if (!members && this.tree.kind === SyntaxKind.Parameter) {
      const param = this.tree as ParameterDeclaration;
      if (param.type && param.type.kind === SyntaxKind.TypeLiteral) {
        members = (param.type as TypeLiteralNode).members;
      }
    }

    if (!members) {
      return false;
    }

    const member = Array.from(members).find((m) => {
      if (m.name && m.name.kind === SyntaxKind.Identifier) {
        return m.name.text === name;
      }

      return false;
    });

    if (!member) {
      return false;
    }

    // Check type if specified
    if (type !== undefined) {
      if (member.kind === SyntaxKind.PropertySignature) {
        const propSig = member as PropertySignature;
        if (!propSig.type) {
          return false;
        }

        const memberType = new Explorer(propSig.type);
        if (!memberType.equals(type)) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Check optionality if specified
    if (isOptional !== undefined) {
      if (member.kind === SyntaxKind.PropertySignature) {
        const propSig = member as PropertySignature;
        const memberIsOptional = propSig.questionToken !== undefined;
        if (memberIsOptional !== isOptional) {
          return false;
        }
      }
    }

    return true;
  }

  // Checks if all specified properties exist in the current tree, which can be an interface, type literal, or variable statement with a type literal annotation
  hasProps(
    props: { name: string; type?: string; isOptional?: boolean }[],
  ): boolean {
    return props.every((prop) =>
      this.hasProp(prop.name, prop.type, prop.isOptional),
    );
  }

  hasTypeParameters(typeParams?: string): boolean {
    if (!this.tree) {
      return false;
    }

    let nodeTypeParams: NodeArray<TypeParameterDeclaration> | undefined;

    // Check if node has typeParameters property
    if ("typeParameters" in this.tree) {
      nodeTypeParams = (
        this.tree as
          | InterfaceDeclaration
          | TypeAliasDeclaration
          | FunctionDeclaration
          | ClassDeclaration
          | MethodDeclaration
      ).typeParameters;
    }

    // Handle VariableStatement with function that has typeParameters
    if (!nodeTypeParams && this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      const { initializer } = declaration;
      if (initializer) {
        if ("typeParameters" in initializer) {
          nodeTypeParams = (initializer as ArrowFunction | FunctionExpression)
            .typeParameters;
        }
      }
    }

    if (typeParams === undefined) {
      return !!(nodeTypeParams && nodeTypeParams.length > 0);
    }

    if (!nodeTypeParams || nodeTypeParams.length === 0) {
      return false;
    }

    const expectedFile = createSourceFile(
      "inline.ts",
      `type __T<${typeParams}> = any`,
      ScriptTarget.Latest,
      true,
      ScriptKind.TS,
    );
    const expectedTypeDecl = expectedFile.statements[0] as TypeAliasDeclaration;
    const expectedTypeParams = expectedTypeDecl.typeParameters!;

    if (nodeTypeParams.length !== expectedTypeParams.length) {
      return false;
    }

    const compareTypeParams = (
      param1: TypeParameterDeclaration,
      param2: TypeParameterDeclaration,
    ): boolean => {
      if (param1.kind !== param2.kind) {
        return false;
      }

      if (param1.name.text !== param2.name.text) {
        return false;
      }

      if (param1.constraint && param2.constraint) {
        const children1: Node[] = [];
        const children2: Node[] = [];
        param1.constraint.forEachChild((child: Node) => children1.push(child));
        param2.constraint.forEachChild((child: Node) => children2.push(child));

        if (children1.length !== children2.length) {
          return false;
        }
      } else if (param1.constraint || param2.constraint) {
        return false;
      }

      if (param1.default && param2.default) {
        const children1: Node[] = [];
        const children2: Node[] = [];
        param1.default.forEachChild((child: Node) => children1.push(child));
        param2.default.forEachChild((child: Node) => children2.push(child));

        if (children1.length !== children2.length) {
          return false;
        }
      } else if (param1.default || param2.default) {
        return false;
      }

      return true;
    };

    for (let i = 0; i < nodeTypeParams.length; i++) {
      if (!compareTypeParams(nodeTypeParams[i], expectedTypeParams[i])) {
        return false;
      }
    }

    return true;
  }

  getTypeParameters(): Explorer[] {
    if (!this.tree) {
      return [];
    }

    let typeParams: NodeArray<TypeParameterDeclaration> | undefined;

    // Check if node has typeParameters property
    if ("typeParameters" in this.tree) {
      typeParams = (
        this.tree as
          | InterfaceDeclaration
          | TypeAliasDeclaration
          | FunctionDeclaration
          | ClassDeclaration
          | MethodDeclaration
      ).typeParameters;
    }

    // Handle VariableStatement with function that has typeParameters
    if (!typeParams && this.tree.kind === SyntaxKind.VariableStatement) {
      const declaration = (this.tree as VariableStatement).declarationList
        .declarations[0];
      const { initializer } = declaration;
      if (initializer) {
        if ("typeParameters" in initializer) {
          typeParams = (initializer as ArrowFunction | FunctionExpression)
            .typeParameters;
        }
      }
    }

    if (!typeParams) {
      return [];
    }

    return Array.from(typeParams).map((tp) => new Explorer(tp));
  }
}

export { Explorer };
