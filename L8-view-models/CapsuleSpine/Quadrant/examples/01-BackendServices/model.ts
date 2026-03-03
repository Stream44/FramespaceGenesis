
export const MODEL_NAME = `@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/examples/01-BackendServices`

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
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
                                    visualizationMethod: {
                                        'getVisualization': {
                                            label: 'Quadrant View'
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
                    LoginService: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/LoginService',
                    },
                    PaymentService: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/PaymentService',
                    },
                    GatewayService: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/GatewayService',
                    },
                    ProfileService: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/ProfileService',
                    },
                    SearchService: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/SearchService',
                    },
                    FeedService: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/FeedService',
                    },
                    AccountDB: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/AccountDB',
                    },
                    ProfilesDB: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './elements/ProfilesDB',
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
        return { api: apis[spine.capsuleSourceLineRef], sitRoot: import.meta.dir }
    }, {
        importMeta: import.meta,
    })
}
