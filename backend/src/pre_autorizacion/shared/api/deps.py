"""FastAPI dependencies (DI bridge).

Las funciones expuestas acá son las que decorás con `Depends(...)` en routers
y use cases. La lógica real de construcción de dependencias vive en
`config/di.py` — esto es solo el adaptador FastAPI.

Dependencias clave:
- `SettingsDep`: settings tipados.
- `JwtServiceDep` / `UserRepositoryDep`: para `auth`.
- `get_current_user`: resuelve el JWT del header → User entity.
- `require_role(role)`: factory que devuelve un Depends que valida rol.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pre_autorizacion.config.di import (
    get_case_repository,
    get_coverage_repository,
    get_file_storage,
    get_insurer_repository,
    get_jwt_service,
    get_llm_provider,
    get_patient_repository,
    get_policy_repository,
    get_procedure_repository,
    get_user_repository,
    get_vision_extractor,
)
from pre_autorizacion.config.settings import Settings, get_settings
from pre_autorizacion.features.auth.application.jwt_service import JwtService
from pre_autorizacion.features.auth.application.use_cases import GetCurrentUserUseCase
from pre_autorizacion.features.auth.domain.entities import Role, User
from pre_autorizacion.features.auth.domain.ports import UserRepository
from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
    CaseRepository,
)
from pre_autorizacion.features.policies.domain.ports.coverage_repository import CoverageRepository
from pre_autorizacion.features.policies.domain.ports.insurer_repository import InsurerRepository
from pre_autorizacion.features.policies.domain.ports.policy_repository import PolicyRepository
from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.shared.domain.errors import AuthError, ForbiddenError
from pre_autorizacion.shared.domain.ports import PatientRepository
from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider
from pre_autorizacion.shared.storage.ports.file_storage import FileStorage
from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractor

# `auto_error=False` para que devuelva None si no hay header — así
# levantamos AuthError nuestro (que mapea a 401 Problem+JSON) en vez
# del 403 default de HTTPBearer.
_bearer = HTTPBearer(auto_error=False)


def get_settings_dep() -> Settings:
    return get_settings()


def _get_jwt_service() -> JwtService:
    return get_jwt_service()


def _get_user_repository() -> UserRepository:
    return get_user_repository()


def _get_case_repository() -> CaseRepository:
    return get_case_repository()


def _get_policy_repository() -> PolicyRepository:
    return get_policy_repository()


def _get_procedure_repository() -> ProcedureRepository:
    return get_procedure_repository()


def _get_patient_repository() -> PatientRepository:
    return get_patient_repository()


def _get_coverage_repository() -> CoverageRepository:
    return get_coverage_repository()


def _get_insurer_repository() -> InsurerRepository:
    return get_insurer_repository()


def _get_file_storage() -> FileStorage:
    return get_file_storage()


def _get_llm_provider() -> LLMProvider:
    return get_llm_provider()


def _get_vision_extractor() -> VisionExtractor:
    return get_vision_extractor()


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
JwtServiceDep = Annotated[JwtService, Depends(_get_jwt_service)]
UserRepositoryDep = Annotated[UserRepository, Depends(_get_user_repository)]
CaseRepositoryDep = Annotated[CaseRepository, Depends(_get_case_repository)]
PolicyRepositoryDep = Annotated[PolicyRepository, Depends(_get_policy_repository)]
ProcedureRepositoryDep = Annotated[ProcedureRepository, Depends(_get_procedure_repository)]
PatientRepositoryDep = Annotated[PatientRepository, Depends(_get_patient_repository)]
CoverageRepositoryDep = Annotated[CoverageRepository, Depends(_get_coverage_repository)]
InsurerRepositoryDep = Annotated[InsurerRepository, Depends(_get_insurer_repository)]
FileStorageDep = Annotated[FileStorage, Depends(_get_file_storage)]
LLMProviderDep = Annotated[LLMProvider, Depends(_get_llm_provider)]
VisionExtractorDep = Annotated[VisionExtractor, Depends(_get_vision_extractor)]


async def get_current_user(
    request: Request,
    jwt_service: JwtServiceDep,
    users: UserRepositoryDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Decodifica el JWT del header `Authorization: Bearer <token>` → User.

    Raises:
        AuthError: si no hay header, el token es inválido, o el user ya no existe.
    """
    if credentials is None or not credentials.credentials:
        raise AuthError("Missing bearer token")

    payload = jwt_service.decode(credentials.credentials, expected_type="access")
    use_case = GetCurrentUserUseCase(users=users)
    user = await use_case.execute(payload.sub)

    # Persiste el user en request.state para logs y handlers downstream.
    request.state.user = user
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_role(*roles: Role) -> Callable[[User], Awaitable[User]]:
    """Factory de dependencia que exige que el usuario actual tenga uno de `roles`."""
    allowed = frozenset(roles)

    async def _checker(user: CurrentUserDep) -> User:
        if user.role not in allowed:
            raise ForbiddenError(
                f"Role '{user.role.value}' not allowed. Required: {sorted(r.value for r in allowed)}"
            )
        return user

    return _checker


async def require_authenticated(user: CurrentUserDep) -> User:
    """Alias semántico de `get_current_user` cuando solo querés exigir login."""
    return user


__all__ = [
    "CaseRepositoryDep",
    "CoverageRepositoryDep",
    "CurrentUserDep",
    "FileStorageDep",
    "InsurerRepositoryDep",
    "JwtServiceDep",
    "LLMProviderDep",
    "PatientRepositoryDep",
    "PolicyRepositoryDep",
    "ProcedureRepositoryDep",
    "SettingsDep",
    "UserRepositoryDep",
    "VisionExtractorDep",
    "get_current_user",
    "get_settings_dep",
    "require_authenticated",
    "require_role",
]
