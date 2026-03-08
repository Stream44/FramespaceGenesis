
export const MODEL_NAME = `@stream44.studio/FramespaceGenesis/examples/Codepath-SimplePasswordLogin/0A-FullStack1`

export async function runModel({ run }) {

    return await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    config: {
                        type: CapsulePropertyTypes.Constant,
                        value: {
                            framespaces: {
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/ModelQueryMethods': {
                                    visualizationMethod: {
                                        'getSwimlaneView': {
                                            label: 'Codepath Swimlane View'
                                        }
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods': {
                                    visualizationMethod: {
                                        'getSpineInstanceTree': {
                                            label: 'Spine Instance Tree'
                                        }
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods#getSpineDeclarationTree': {
                                    visualizationMethod: {
                                        'getSpineDeclarationTree': {
                                            label: 'Spine Declaration Tree'
                                        }
                                    }
                                },
                            }
                        }
                    },
                    user: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/User',
                    },
                    runModel: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any) {
                            return this.user.login('userexample.com', 'validPassword123')
                        }
                    },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: MODEL_NAME
        })
        return { spine }
    }, async ({ spine, apis }: any) => {
        const api = apis[spine.capsuleSourceLineRef]
        const result = api.runModel()
        return { api, sitRoot: import.meta.dir, result }
    }, {
        importMeta: import.meta,
        captureEvents: true,
    })
}
