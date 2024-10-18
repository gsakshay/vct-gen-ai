import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Import Lambda L2 construct
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as bedrock from "aws-cdk-lib/aws-bedrock";

interface LambdaFunctionStackProps {  
  readonly wsApiEndpoint : string;  
  readonly sessionTable : Table;  
  readonly feedbackTable : Table;
  readonly feedbackBucket : s3.Bucket;
  readonly knowledgeBucket : s3.Bucket;
  readonly knowledgeBase : bedrock.CfnKnowledgeBase;
  readonly knowledgeBaseSource: bedrock.CfnDataSource;
}

export class LambdaFunctionStack extends cdk.Stack {  
  public readonly chatFunction : lambda.Function;
  public readonly sessionFunction : lambda.Function;
  public readonly feedbackFunction : lambda.Function;
  public readonly deleteS3Function : lambda.Function;
  public readonly getS3Function : lambda.Function;
  public readonly uploadS3Function : lambda.Function;
  public readonly syncKBFunction : lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionStackProps) {
    super(scope, id);    

    const sessionAPIHandlerFunction = new lambda.Function(scope, 'SessionHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'session-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "DDB_TABLE_NAME" : props.sessionTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });
    
    sessionAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.sessionTable.tableArn, props.sessionTable.tableArn + "/index/*"]
    }));

    this.sessionFunction = sessionAPIHandlerFunction;

        // Define the Lambda function resource
        const websocketAPIFunction = new lambda.Function(scope, 'ChatHandlerFunction', {
          runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
          code: lambda.Code.fromAsset(path.join(__dirname, 'websocket-chat')), // Points to the lambda directory
          handler: 'index.handler', // Points to the 'hello' file in the lambda directory
          environment : {
            "WEBSOCKET_API_ENDPOINT" : props.wsApiEndpoint.replace("wss","https"),            
            "PROMPT" : `You are a Valorant team manager and data scientist assisting in the scouting and recruitment process for a new VALORANT esports team. Your responsibilities include:

**Primary Tasks:**

1. **Team Composition Creation:**
   - Build teams based on specific criteria provided by the user, such as professional level, regional diversity, and inclusivity.
   - Assign roles to players, including offensive or defensive roles, agent categories (Duelist, Sentinel, Controller, Initiator), and designate an in-game leader (IGL).

2. **Performance Analysis:**
   - Answer questions about player performance with specific agents.
   - Provide statistics and recent performance data to justify player selections.

3. **Strategic Insights:**
   - Recommend strategies that explain why the team composition would be effective in competitive matches.
   - Hypothesize team strengths and weaknesses.

**Agent Roles:**

- **Duelists (Aggressive Entry):** Jett, Phoenix, Reyna, Raze, Yoru, Neon, Iso
- **Controllers (Map Control with Smokes):** Brimstone, Omen, Viper, Astra, Harbor, Clove
- **Initiators (Intel and Disruption):** Sova, Breach, Skye, KAY/O, Fade, Gekko
- **Sentinels (Defense and Zone Control):** Sage, Cypher, Killjoy, Chamber, Deadlock, Vyse

**Team Composition Guidelines:**

- **Balanced Team Structure:**
  - **Controller (1+):** Essential for map control with smokes and area denial.
  - **Initiator (1+):** Provides intel and disrupts enemy setups.
  - **Sentinel (1):** Secures sites and monitors flanks.
  - **Duelist (1-2):** Leads aggressive entries and creates space.

**Instructions for Generating Responses:**

1. **Assess the User’s Query:**
   - Identify the team submission type and specific requirements.
   - Note any preferences or constraints provided by the user.

2. **Data Retrieval and Analysis:**
   - Utilize provided tools to gather current information on players.
   - Analyze player performance, agent proficiency, recent achievements, and regional representation.

3. **Team Composition Creation:**
   - **Select Players:**
     - Choose players that meet the user's criteria and complement each other's playstyles.
     - Ensure diversity and balance in roles and agent selection.
   - **Assign Roles and Agents:**
     - Assign each player a specific role (offensive/defensive) and agent category.
     - Specify the agent they will play.
     - Include relevant key justifications (such as statistics, achievements, or qualities) for each player to support their selection.

4. **Thought Processes:**
   - Enclose internal reasoning within descriptive tags (e.g., \`<retrieving_players>\`, \`<analyzing_performance>\`).
   - Do not include the user's original message in these tags.

5. **Final Answer:**
   - Provide the final team composition and explanations outside of any tags.
   - Ensure clarity, professionalism, and that all aspects of the user's request are addressed.
   - Once you have completed the response, at the end of the message send player data in a JSON format use the tool \'return_json\'.

6. **Response Style:**
   - Communicate in a clear and concise manner.
   - Maintain a professional and helpful tone.
   - Encourage user engagement by inviting follow-up questions.

**Important Guidelines:**

- **Accuracy and Relevance:**
  - Ensure all information is accurate and up-to-date.
  - Base recommendations on reliable data sources.

- **Inclusivity and Diversity:**
  - Promote inclusive team structures when requested.

- **Professional Communication:**
  - Maintain a positive and professional tone.
  - Provide clear, concise, and informative responses.

- **Confidentiality:**
  - Do not disclose any confidential or sensitive information.

**Tool Usage:**

- Use tools like \`player_info\`, \`list_players\`, and \`query_db\` to retrieve necessary data.
- Integrate tool outputs seamlessly into your responses without mentioning the tool usage explicitly.
- The last tool to be used should be the \'return_json\' tool to provide player data in a JSON format.
`,
            'KB_ID' : props.knowledgeBase.attrKnowledgeBaseId
          },
          timeout: cdk.Duration.seconds(300)
        });
        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:InvokeModelWithResponseStream',
            'bedrock:InvokeModel',
            
          ],
          resources: ["*"]
        }));
        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:Retrieve'
          ],
          resources: [props.knowledgeBase.attrKnowledgeBaseArn]
        }));

        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:ListBucket",
            "athena:StartQueryExecution",
            "athena:GetQueryExecution",
            "athena:GetQueryResults",
            "s3:GetBucketLocation",
            "glue:GetDatabase",
            "glue:GetDatabases",
            "glue:GetTable",
            "glue:GetTables",
            "glue:GetPartition",
            "glue:GetPartitions"
          ],
          resources: [`arn:aws:athena:us-east-1:${cdk.Stack.of(this).account}:workgroup/*`,
                "arn:aws:s3:::riot-unzipped/*",
                "arn:aws:s3:::riot-unzipped",                
                `arn:aws:glue:us-east-1:${cdk.Stack.of(this).account}:catalog`,
                `arn:aws:glue:us-east-1:${cdk.Stack.of(this).account}:catalog/*`,
                `arn:aws:glue:us-east-1:${cdk.Stack.of(this).account}:database/*`,
                `arn:*:glue:us-east-1:${cdk.Stack.of(this).account}:table/*`]
        }));  

        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:InvokeFunction'
          ],
          resources: [this.sessionFunction.functionArn]
        }));
        
        this.chatFunction = websocketAPIFunction;

    const feedbackAPIHandlerFunction = new lambda.Function(scope, 'FeedbackHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'feedback-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "FEEDBACK_TABLE" : props.feedbackTable.tableName,
        "FEEDBACK_S3_DOWNLOAD" : props.feedbackBucket.bucketName
      },
      timeout: cdk.Duration.seconds(30)
    });
    
    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.feedbackTable.tableArn, props.feedbackTable.tableArn + "/index/*"]
    }));

    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.feedbackBucket.bucketArn,props.feedbackBucket.bucketArn+"/*"]
    }));

    this.feedbackFunction = feedbackAPIHandlerFunction;
    
    const deleteS3APIHandlerFunction = new lambda.Function(scope, 'DeleteS3FilesHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/delete-s3')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    deleteS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.deleteS3Function = deleteS3APIHandlerFunction;

    const getS3APIHandlerFunction = new lambda.Function(scope, 'GetS3FilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/get-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    getS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.getS3Function = getS3APIHandlerFunction;


    const kbSyncAPIHandlerFunction = new lambda.Function(scope, 'SyncKBHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/kb-sync')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "KB_ID" : props.knowledgeBase.attrKnowledgeBaseId,      
        "SOURCE" : props.knowledgeBaseSource.attrDataSourceId  
      },
      timeout: cdk.Duration.seconds(30)
    });

    kbSyncAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:*'
      ],
      resources: [props.knowledgeBase.attrKnowledgeBaseArn]
    }));
    this.syncKBFunction = kbSyncAPIHandlerFunction;

    const uploadS3APIHandlerFunction = new lambda.Function(scope, 'UploadS3FilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/upload-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    uploadS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.uploadS3Function = uploadS3APIHandlerFunction;

  }
}
