import {
  Node,
  createSourceFile,
  ScriptTarget,
  ScriptKind,
  SyntaxKind,
  SourceFile,
} from "typescript";

function createEmptyNode(): Node {
  return {
    kind: SyntaxKind.Unknown,
    getChildCount: () => 0,
    getText: () => "Empty Node",
  } as Node;
}

function createTree(code: string | Node): Node {
  if (typeof code === "string") {
    if (!code.trim()) {
      return createEmptyNode();
    }

    const sourceFile = createSourceFile(
      "inline.ts",
      code,
      ScriptTarget.Latest,
      true,
      ScriptKind.TS,
    );
    return sourceFile.statements.length === 1
      ? sourceFile.statements[0]
      : sourceFile;
  }

  return code;
}

class Explorer {
  private tree: Node;

  constructor(tree: string | Node) {
    this.tree = createTree(tree);
  }

  isEmpty(): boolean {
    return this.tree.getChildCount() === 0;
  }

  toString(): string {
    return this.tree.getText();
  }

  findAll(kind: SyntaxKind): Explorer[] {
    const nodes: Explorer[] = [];
    const root = this.tree;

    // Check if the root is a SourceFile or a single node
    if (root.kind === SyntaxKind.SourceFile) {
      // Iterate through the statements of the SourceFile
      (root as SourceFile).statements.forEach((statement) => {
        if (statement.kind === kind) {
          nodes.push(new Explorer(statement));
        }
      });
    }

    // If the root is a single node, check if it matches the kind
    if (root.kind === kind) {
      nodes.push(new Explorer(root));
    }

    return nodes;
  }
}

export { Explorer };

const e = new Explorer(`
type MyType<T> = {
  prop: T;
}

let a: string = "hello";

let b: number = 42;
`);
console.log(e.isEmpty());
console.log(e.toString());
console.log(new Explorer("").isEmpty());
console.log(new Explorer("").toString());
console.log(
  e
    .findAll(SyntaxKind.VariableStatement)
    .map((explorer) => explorer.toString()),
);
