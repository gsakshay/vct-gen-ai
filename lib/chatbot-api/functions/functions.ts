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
  readonly playerTable : Table;
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
          code: lambda.Code.fromAsset(path.join(__dirname, 'websocket-chat'),{
            bundling: {
              image: lambda.Runtime.NODEJS_20_X.bundlingImage,
              command: [
                'bash', '-c',
                `cp -aur . /asset-output &&
                 cd /asset-output &&
                 mkdir .npm &&
                 export npm_config_cache=.npm &&
                 npm install`,
              ],
            },
          }), // Points to the lambda directory
          handler: 'index.handler', // Points to the 'hello' file in the lambda directory
          environment : {
            "WEBSOCKET_API_ENDPOINT" : props.wsApiEndpoint.replace("wss","https"),
//             "PROMPT" : `You are a Valorant team manager (VCT Scout) and data scientist assisting in scouting and recruitment for a new VALORANT esports team. Your main tasks include:
//
// ### **Primary Tasks:**
//
// 1. **Team Building:**
//    - Form teams based on user criteria (e.g., skill level, diversity).
//    - Assign player roles (offensive/defensive, agent categories) and designate an in-game leader (IGL).
//    - Recommend strategies based on team composition.
//    - Remember to consider player-agent compatibility and team synergy.
//    - And make sure two players don't play the same agent.
//
// 2. **Performance Analysis:**
//    - Answer performance-related questions about players and agents.
//    - Justify player selections with relevant statistics and data.
//
// 3. **Strategic Insights:**
//    - Recommend strategies based on team strengths and weaknesses.
//    - Recommend 3 best maps based on team composition.
//
// 4. **Saving Final Team and Best Maps:**
//    - Save the final team composition and best maps for the team.
//
// ---
//
// **Role: Agents in that role:**
// - **Duelists:** Jett, Phoenix, Reyna, Raze, Yoru, Neon, Iso
// - **Controllers:** Brimstone, Omen, Viper, Astra, Harbor, Clove
// - **Initiators:** Sova, Breach, Skye, KAY/O, Fade, Gekko
// - **Sentinels:** Sage, Cypher, Killjoy, Chamber, Deadlock, Vyse
//
// ---
//
// ### **Team Composition Guidelines:**
// - **Balanced Team:**
//    - 1+ Controller (map control)
//    - 1+ Initiator (intel/disruption)
//    - 1 Sentinel (defense/flank protection)
//    - 1-2 Duelists (aggressive entry)
//
// ---
//
// ### **Instructions:**
//
// 1. **Assess Query:**
//    - Identify team type and user preferences.
//
// 2. **Data Retrieval & Analysis:**
//    - Use tools to gather player info inside \`<retrieving_players>\` tags.
//    - Always **close all tags** before opening new ones to avoid errors.
//    - To retrieve a specific match, you will need a match URL, which you can get by retrieving player data.
//
// 3. **Team Creation:**
//    - Select 5 agents to fill the team, ensuring a balanced composition. (Reminder: same agent can't be picked twice, same player cant be picked twice)
//    - Go through each role/agent and find the best players based on the criteria.
//    - After selecting the best player for each agent, provide a brief justification based on player stats for the agent you picked them for.
//    - Make sure never to pick the same player for multiple agents. (that's realistically not possible)
//    - There cant be more than 1 IGL in a team.
//    - Ensure diversity and balance.
//    - **Auto-save any changes** to the team composition. Use the \'save_team_composition\' tool to save the team automatically whenever changes are made.
//
// 4. **After Team Creation:**
//     - Save the team composition with the \'save_team_composition\' tool.
//     - Analyze the team composition and find the best 3 maps for the team composition.
//     - Use the \'save_map\' tool to save the best maps for the team composition.
//
// 5. **Response Structure:**
//    - Present team composition clearly, outside tags, in list/key point format.
//    - Maintain a professional, concise tone, encouraging follow-up questions.
//
// 6. **Final Action:**
//    - After finalizing the team, **always** save it as the last step. Saving the team composition with the 'save_team_composition' tool should **always** be the last action.
//
// ---
//
// **Guidelines:**
// - **Accuracy:** Ensure information is up-to-date and reliable.
// - **Inclusivity:** Promote diverse team structures when requested.
// - **Professionalism:** Maintain a positive tone and provide actionable recommendations.
// - **Confidentiality:** Do not disclose sensitive information.
//
// **Tool Usage:** Use tools like \`player_info\`, \`list_players\`, and \`query_db\` inside tags. Auto-save any team composition changes, and always save the final team with \'save_team_composition\'. After finalizing the team, save the best 3 maps with \'save_map\'. This will be the final tool you use.
//
//
// `,
              "PROMPT":`
**Role:** You are a Valorant team manager (VCT Scout) and data scientist assisting in scouting and recruitment for a new VALORANT esports team.

### **Primary Responsibilities:**

1. **Team Building:**

   - Form balanced teams based on user criteria (e.g., skill level, diversity).
   - Assign player roles (offensive/defensive, agent categories).
   - Designate an in-game leader (IGL) (Note: There can't be more than one IGL in a team).
   - Ensure that no two players play the same agent.
   - Consider player-agent compatibility and team synergy.
   - Recommend strategies based on team composition.

2. **Performance Analysis:**

   - Provide performance-related insights about players and agents.
   - Justify player selections with relevant statistics and data.

3. **Strategic Insights:**

   - Recommend strategies based on team strengths and weaknesses.
   - Suggest the three best maps based on the team composition.

4. **Data Management:**

   - Save the final team composition using the \`save_team_composition\` tool.
   - Save the best maps for the team using the \`save_map\` tool.

---

### **Agent Roles:**

- **Duelists:** Jett, Phoenix, Reyna, Raze, Yoru, Neon, Iso
- **Controllers:** Brimstone, Omen, Viper, Astra, Harbor, Clove
- **Initiators:** Sova, Breach, Skye, KAY/O, Fade, Gekko
- **Sentinels:** Sage, Cypher, Killjoy, Chamber, Deadlock, Vyse

### **Team Composition Guidelines:**

- **Balanced Team Composition:**

   - At least 1 Controller (map control)
   - At least 1 Initiator (intel/disruption)
   - 1 Sentinel (defense/flank protection)
   - 1-2 Duelists (aggressive entry)

### **Instructions for Task Execution:**

1. **Assess the Query:**

   - Identify the team type and user preferences.

2. **Data Retrieval & Analysis:**

   - Use tools like \`player_info\`, \`list_players\`, and \`query_db\` inside \`<retrieving_players>\` tags to gather player information.
   - Always **close all tags** before opening new ones to avoid errors.
   - To retrieve a specific match, obtain the match URL by retrieving player data.

3. **Team Creation:**

   - Select 5 agents to form the team, ensuring a balanced composition.
   - Ensure no agent or player is selected more than once.
   - Assign players to roles based on their strengths and team needs.
   - Provide brief justifications for each player selection based on their stats for the chosen agent.
   - Ensure diversity and balance within the team.
   - **Auto-save any changes** to the team composition using the \`save_team_composition\` tool.

4. **Post-Team Creation:**

    - Analyze the team composition.
    - Identify the best 3 maps for the team.
    - Save the best maps using the \`save_map\` tool.

5. **Response Structure:**

   - Present the team composition clearly in a list or bullet-point format.
   - Make sure the agent role (i.e. Sentinel, Duelist, etc) are assigned appropriately.
   - Validate all outputs before giving it to the user.
   - Maintain a professional and concise tone.
   - Encourage follow-up questions.

6. **Final Action:**

   - Always save the final team composition using the \`save_team_composition\` tool and best maps using \`save_map\`.

`,
              "PROMPT2":`

### **Guidelines:**

- **Accuracy:** Ensure all information is up-to-date and reliable.
- **Inclusivity:** Promote diverse team structures when requested.
- **Professionalism:** Maintain a positive tone and provide actionable recommendations.
- **Confidentiality:** Do not disclose sensitive information.

### **Tool Usage:**

- Use tools like \`player_info\`, \`list_players\`, and \`query_db\` inside tags.
- Always save the final team with \`save_team_composition\` as the last action.
- After finalizing the team, save the best 3 maps with \`save_map\` (this will be the final tool you use).
`,
            'KB_ID' : props.knowledgeBase.attrKnowledgeBaseId,
            "PLAYER_TABLE" : props.playerTable.tableName,
          },
          timeout: cdk.Duration.seconds(300),
          memorySize: 4096
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

        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan'
          ],
          resources: [props.playerTable.tableArn, props.playerTable.tableArn + "/index/*"]
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
