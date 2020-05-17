const execa = require('execa')
const path = require('path')
const Listr = require('listr')
const ora = require('ora')
const chalk = require('chalk')
const fetch = require("node-fetch")
var exec = require( 'child_process' ).exec
const {Command, flags} = require('@oclif/command')
require('dotenv').config({path: path.resolve(__dirname, '..', '.env')})

class CreateCommand extends Command {
  static args = [{
      name: 'name',
      description: 'Project/Instance name',
      required: true
  }]
  static flags = {
    help: flags.help({
        char: 'h'
    }),
    instance: flags.boolean({
        char: 'i',
        multiple: false,
        required: false,
        description: 'Create GCloud instance',
        exclusive: ['project'],
    }),
    project: flags.boolean({
        char: 'p',
        multiple: false,
        required: false,
        description: 'Create project',
        exclusive: ['instance'],
    }),
  }

  async run() {
    const {args, flags} = this.parse(CreateCommand)
    if(flags.instance){
        const spinner = ora(chalk.blue('Creating instance '+args.name)).start();
        execa('gcloud', ['compute', 'instances', 'create', args.name,
            '--zone=us-central1-a', '--machine-type=n1-standard-2', '--image=ubuntu-1604-xenial-v20200429', '--image-project=ubuntu-os-cloud'])
            .then((output) => {
                spinner.succeed(chalk.green('Created instance '+args.name))
                console.log(output.stdout);
            })
            .catch((error) => {
                spinner.fail(chalk.red('Failed creating instance'))
                console.log(error.stderr);
            })
    }else if (flags.project) {
        const dir = path.join(process.env.PROJECT_DIR, args.name);
        const readme = path.join(dir, "README.md");
        const gitignore = path.join(dir, ".gitignore");
        const gitrepo = process.env.GITHUB_URL + args.name
        const body = {
        	"name": args.name,
        	"description": args.name,
        	"private": true
        }
        const tasks = new Listr([
            {
                title: 'Creating directory',
                task: () => execa('mkdir', ['-p', dir])
            },
            {
                title: 'Adding required files',
                task: () => {
                    execa('touch', [readme])
                    execa('touch', [gitignore])
                }
            },
            {
                title: 'Creating git repo',
                task: () => fetch('https://api.github.com/user/repos', {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'token ' + process.env.GITHUB_TOKEN },
                })
            },
            {
                title: 'Pushing to git',
                task: () => {
                    (async () => {
                        await execa('git', ['init'], {cwd: dir})
                        await execa('git', ['remote', 'add', 'origin', gitrepo], {cwd: dir})
                        await execa('git', ['add', '--all'], {cwd: dir})
                        await execa('git', ['commit', '-m', 'Initial commit :tada:'], {cwd: dir})
                        await execa('git', ['push', '-u', 'origin', 'master'], {cwd: dir})
                    })();
                }
            },
        ]);
        tasks.run().catch(err => {
            console.error(err);
        });
    }
  }
}

CreateCommand.description = `
CLI to create new project/instance
`

module.exports = CreateCommand
