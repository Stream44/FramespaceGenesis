/**
 * Mapping spine structure: composes other capsules as sub-components via Mapping properties.
 * No extends, no struct delegates — pure composition through mappings.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                standalone: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './Standalone',
                },
                baseService: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './BaseService',
                    options: {
                        '#': {
                            serviceName: 'orchestrated-service'
                        }
                    }
                },
                orchestrate: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Orchestrating: ${this.standalone.name} + ${this.baseService.serviceName}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/MappingOrchestrator'
