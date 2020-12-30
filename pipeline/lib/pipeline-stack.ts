import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import codecommit = require('@aws-cdk/aws-codecommit');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');


export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket");
    const codeRepo = codecommit.Repository.fromRepositoryName(
      this,
      'AppRepository',
      'sam-app');
    
    const pipeline = new codepipeline.Pipeline(
      this,
      'Pipeline',
      {artifactBucket: artifactsBucket}
    );
    
    const sourceOutput = new codepipeline.Artifact();
    
    pipeline.addStage({
      stageName: 'Source',
      actions: [
          new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'CodeCommit_Source',
            repository: codeRepo,
            output: sourceOutput
          })
        ]
    });
    
    const buildOutput = new codepipeline.Artifact();
    const buildProject = new codebuild.PipelineProject(this, 'Build', {
      environment: {buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3},
      environmentVariables: {
        'PACKAGE_BUCKET': {
          value: artifactsBucket.bucketName
        }
      }
    });
    
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput]
        })
      ]
    });
    
    pipeline.addStage({
      stageName: 'Dev',
      actions: [
        new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
          actionName: 'CreateChangeSet',
          templatePath: buildOutput.atPath('packaged.yaml'),
          stackName: 'sam-app',
          adminPermissions: true,
          changeSetName: 'sam-app-dev-changeset',
          runOrder: 1
        }),
        new codepipeline_actions.CloudFormationExecuteChangeSetAction({
          actionName: 'Deploy',
          stackName: 'sam-app',
          changeSetName: 'sam-app-dev-changeset',
          runOrder: 2
        })
      ]
    })
    
  }
}
